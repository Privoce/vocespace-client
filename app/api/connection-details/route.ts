import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '../conf/conf';

const COOKIE_KEY = 'random-participant-postfix';

const {
  livekit: { url: LIVEKIT_URL, key: API_KEY, secret: API_SECRET },
} = getConfig();

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const spaceName = request.nextUrl.searchParams.get('spaceName');
    const participantName = request.nextUrl.searchParams.get('participantName');
    const metadata = request.nextUrl.searchParams.get('metadata') ?? '';
    const region = request.nextUrl.searchParams.get('region');
    // with auth id (from vocespace platform)
    const auth = request.nextUrl.searchParams.get('auth');
    const livekitServerUrl = region ? getLiveKitURL(region) : LIVEKIT_URL;
    let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
    if (livekitServerUrl === undefined) {
      throw new Error('Invalid region');
    }

    if (typeof spaceName !== 'string') {
      return new NextResponse('Missing required query parameter: spaceName', { status: 400 });
    }
    if (participantName === null) {
      return new NextResponse('Missing required query parameter: participantName', { status: 400 });
    }

    // Generate participant token
    // if (!randomParticipantPostfix) {
    //   randomParticipantPostfix = randomString(4);
    // }
    let identity = `${participantName}__${spaceName}`;
    if (auth) {
      identity = auth;
    }
    const participantToken = await createParticipantToken(
      {
        // identity: `${participantName}__${randomParticipantPostfix}`,
        identity: identity,
        name: participantName,
        metadata,
      },
      spaceName,
      API_KEY,
      API_SECRET,
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: livekitServerUrl,
      roomName: spaceName,
      participantToken: participantToken,
      participantName: participantName,
    };
    return new NextResponse(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  spaceName: string,
  key: string,
  secret: string,
) {
  const at = new AccessToken(key, secret, userInfo);
  at.ttl = '5m';
  const grant: VideoGrant = {
    room: spaceName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
  };
  at.addGrant(grant);
  return at.toJwt();
}

/**
 * Get the LiveKit server URL for the given region.
 */
function getLiveKitURL(region: string | null): string {
  let targetKey = 'LIVEKIT_URL';
  if (region) {
    targetKey = `LIVEKIT_URL_${region}`.toUpperCase();
  }
  const url = process.env[targetKey];
  if (!url) {
    throw new Error(`${targetKey} is not defined`);
  }
  return url;
}

function getCookieExpirationTime(): string {
  var now = new Date();
  var time = now.getTime();
  var expireTime = time + 60 * 120 * 1000;
  now.setTime(expireTime);
  return now.toUTCString();
}
