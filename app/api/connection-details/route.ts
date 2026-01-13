import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '../conf/conf';

const COOKIE_KEY = 'random-participant-postfix';

const {
  livekit: { url: LIVEKIT_URL, key: API_KEY, secret: API_SECRET },
} = getConfig();

interface SohiveTokenRes {
  /**
   * 用户ID
   */
  id: string;
  /**
   * 用户名
   */
  username: string;
  /**
   * 空间名
   */
  space: string;
  /**
   * 房间名
   */
  room: string;
  /**
   * 身份类型，目前只有两种
   * 1. 客服人员
   * 2. 顾客
   */
  identity: 'assistant' | 'customer';
  iat: number;
  exp: number;
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const spaceName = request.nextUrl.searchParams.get('spaceName');
    const participantName = request.nextUrl.searchParams.get('participantName');
    const metadata = request.nextUrl.searchParams.get('metadata') ?? '';
    const region = request.nextUrl.searchParams.get('region');
    // with auth id (from vocespace platform)
    const auth = request.nextUrl.searchParams.get('auth');
    // special handling for sohive auth: /api/connection-details?auth=sohive&token=xxx
    // 通过这种方式接入的用户，必须提供 token 参数，通过解析 token 获取用户名和空间名以及房间名，这样用户可以直接进入指定的房间
    if (auth === 'sohive') {
      return await sohiveLogin(request);
    }

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
    console.warn('auth', auth);
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

const sohiveLogin = async (request: NextRequest) => {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return new NextResponse('Missing required query parameter: token', { status: 400 });
  }
  // token may be either a base64 encoded JSON or a JWT (header.payload.signature)
  let decodedToken = '';
  if (token.includes('.')) {
    // treat as JWT and decode payload (base64url)
    try {
      const parts = token.split('.');
      if (parts.length < 2) throw new Error('Invalid JWT token');
      let payload = parts[1];
      // base64url -> base64
      payload = payload.replace(/-/g, '+').replace(/_/g, '/');
      // pad with '=' to make length multiple of 4
      while (payload.length % 4 !== 0) payload += '=';
      decodedToken = Buffer.from(payload, 'base64').toString('utf-8');
    } catch (e) {
      return new NextResponse('Invalid token format', { status: 400 });
    }
  } else {
    // decode base64 token
    try {
      decodedToken = Buffer.from(token, 'base64').toString('utf-8');
    } catch (e) {
      return new NextResponse('Invalid token format', { status: 400 });
    }
  }

  let sohiveTokenRes: SohiveTokenRes;
  try {
    const res = JSON.parse(decodedToken);
    sohiveTokenRes = res;
  } catch (e) {
    return new NextResponse('Invalid token format', { status: 400 });
  }
  // 获取到必要数据之后就可以生成 participant token 继续后续流程
  const participantToken = await createParticipantToken(
    {
      identity: sohiveTokenRes.id,
      name: sohiveTokenRes.username,
      metadata: '',
    },
    sohiveTokenRes.space,
    API_KEY,
    API_SECRET,
  );
  const livekitServerUrl = LIVEKIT_URL;
  // default is undefined
  let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
  if (livekitServerUrl === undefined) {
    throw new Error('Invalid region');
  }
  // Return connection details
  const data: ConnectionDetails = {
    serverUrl: livekitServerUrl,
    roomName: sohiveTokenRes.space,
    participantToken: participantToken,
    participantName: sohiveTokenRes.username,
  };
  // return new NextResponse(JSON.stringify(data), {
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Set-Cookie': `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
  //   },
  // });
  // 这里我们就不能去返回了，而是进行重定向到对应的space页面，并携带auth参数，让前端去处理
  const redirectUrl = new URL(
    `/${sohiveTokenRes.space}?auth=sohive&room=${sohiveTokenRes.room}&data=${encodeURIComponent(
      JSON.stringify(data),
    )}`,
    request.nextUrl.origin,
  );
  return NextResponse.redirect(redirectUrl, {
    headers: {
      'Set-Cookie': `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
    },
  });
};
