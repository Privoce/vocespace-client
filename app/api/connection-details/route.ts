import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '../conf/conf';
import { generateToken, parseToken } from '@/lib/hooks/platformToken';
import { AuthType, generateBasicIdentity, TokenResult, verifyPlatformUser, verifyTokenResult } from '@/lib/std';

const COOKIE_KEY = 'random-participant-postfix';

const {
  livekit: { url: LIVEKIT_URL, key: API_KEY, secret: API_SECRET },
  serverUrl
} = getConfig();

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

const PlatformLogin = async (request: NextRequest, auth: AuthType) => {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return new NextResponse('Missing required query parameter: token', { status: 400 });
  }

  let tokenRes: TokenResult;
  try {
    tokenRes = parseToken(token);
  } catch (e) {
    return new NextResponse('Invalid token format', { status: 400 });
  }
  
  // 检查Token有效性
  if (!verifyPlatformUser(tokenRes)) {
    return new NextResponse('Token is expired', { status: 401 });
  }

  // default is undefined
  let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
  const { token: participantToken, details } = await generateData(
    tokenRes.identity,
    tokenRes.username,
    tokenRes.space,
    token,
  );

  // 这里我们就不能去返回了，而是进行重定向到对应的space页面，并携带auth参数，让前端去处理
  let base = serverUrl || request.nextUrl.origin;
  if (typeof base === 'string' && !/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  const redirectUrl = new URL(
    `/${tokenRes.space}?auth=${auth}&details=${encodeURIComponent(
      JSON.stringify(details),
    )}&data=${encodeURIComponent(JSON.stringify(tokenRes))}`,
    base,
  );
  return NextResponse.redirect(redirectUrl, {
    headers: {
      'Set-Cookie': `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
    },
  });
};

const generateData = async (
  identity: string,
  username: string,
  space: string,
  metadata?: string,
) => {
  const serverUrl = LIVEKIT_URL;

  if (!serverUrl) throw new Error('LiveKit server URL is not configured');

  // 获取到必要数据之后就可以生成 participant token 继续后续流程
  const participantToken = await createParticipantToken(
    {
      identity,
      name: username,
      metadata: metadata || '',
    },
    space,
    API_KEY,
    API_SECRET,
  );

  const connectDetails: ConnectionDetails = {
    serverUrl: serverUrl,
    roomName: space,
    participantToken: participantToken,
    participantName: username,
  };
  return {
    token: participantToken,
    details: connectDetails,
  };
};

// ------- GET /api/connection-details ---------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const spaceName = request.nextUrl.searchParams.get('spaceName');
    const participantName = request.nextUrl.searchParams.get('participantName');
    const metadata = request.nextUrl.searchParams.get('metadata') ?? '';
    const region = request.nextUrl.searchParams.get('region');
    const uIdentity = request.nextUrl.searchParams.get('identity');
    // with auth id (from vocespace platform)
    const auth = request.nextUrl.searchParams.get('auth') as AuthType | null;
    // special handling for sohive auth: /api/connection-details?auth=sohive&token=xxx
    // 通过这种方式接入的用户，必须提供 token 参数，通过解析 token 获取用户名和空间名以及房间名，这样用户可以直接进入指定的房间
    if (auth) {
      return await PlatformLogin(request, auth);
    } else {
      // 没有 auth 参数，走普通流程
      let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
      if (typeof spaceName !== 'string') {
        return new NextResponse('Missing required query parameter: spaceName', { status: 400 });
      }
      if (participantName === null) {
        return new NextResponse('Missing required query parameter: participantName', {
          status: 400,
        });
      }

      let identity = uIdentity || generateBasicIdentity(participantName, spaceName);
      const { details: data } = await generateData(identity, participantName, spaceName, metadata);

      return new NextResponse(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
        },
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

// ------- POST /api/connection-details ---------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // 用户传递 payload 来生成 token 和连接信息，用于其他平台希望接入 Vocespace 使用
    const tokenPayload: Partial<TokenResult> = await request.json();
    if (!verifyTokenResult(tokenPayload))
      return new NextResponse('Invalid token payload', { status: 400 });
    // 通过 tokenPayload 生成 participant token
    const token = generateToken(tokenPayload as TokenResult);
    return NextResponse.json({ token });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}
