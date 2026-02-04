import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '../conf/conf';
import { generateToken, parseToken } from '@/lib/hooks/platformToken';
import {
  AuthType,
  generateBasicIdentity,
  TokenResult,
  verifyPlatformUser,
  verifyTokenResult,
} from '@/lib/std';
import { SpaceInfo } from '@/lib/std/space';

const COOKIE_KEY = 'random-participant-postfix';

const {
  livekit: { url: LIVEKIT_URL, key: API_KEY, secret: API_SECRET },
  serverUrl,
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
  const isFromServer = request.nextUrl.searchParams.get('fromServer');
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
    tokenRes.id,
    tokenRes.username,
    tokenRes.space,
    token,
  );

  // 这里我们就不能去返回了，而是进行重定向到对应的space页面，并携带auth参数，让前端去处理
  let base = serverUrl || request.nextUrl.origin;
  // let base = request.nextUrl.origin;
  if (typeof base === 'string' && !/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  const redirectUrl = new URL(
    `/${tokenRes.space}?auth=${auth}&details=${encodeURIComponent(
      JSON.stringify(details),
    )}&data=${encodeURIComponent(JSON.stringify(tokenRes))}`,
    base,
  );
  if (isFromServer === 'true') {
    // 来自后端的请求，直接返回连接详情JSON,让前端处理重定向
    return NextResponse.json({
      redirectUrl: redirectUrl.toString(),
      cookie: `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
    });
  } else {
    return NextResponse.redirect(redirectUrl, {
      headers: {
        'Set-Cookie': `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
      },
    });
  }
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

const verifyWhitList = (name: string, id?: string | null, whiteList?: string[]): boolean => {
  if (!whiteList || whiteList.length === 0) {
    return false;
  }

  if (whiteList.includes('*')) {
    return true;
  }

  const normalize = (item: string) => item.replace(/^USER-/i, '');

  if (!id) {
    // 没有 ID，先精确匹配白名单项或 USER-<name>，再做前缀/包含容错匹配
    if (whiteList.includes(name)) return true;
    if (whiteList.includes(`USER-${name}`)) return true;
    if (
      whiteList.some((item) => {
        const n = normalize(item);
        return n === name || n.startsWith(name) || name.startsWith(n);
      })
    )
      return true;
  } else {
    // 有 ID 优先检查 ID，其次做类似的名称容错匹配
    if (whiteList.includes(id)) return true;
    if (
      whiteList.some((item) => {
        const n = normalize(item);
        return n === name || n.startsWith(name) || name.startsWith(n);
      })
    )
      return true;
  }

  return false;
};

// 向 /api/space 接口查询空间是否存在
const isSpaceExist = async (spaceName: string): Promise<boolean> => {
  try {
    // 构建请求 URL（使用配置的 serverUrl 或本地相对路径）
    const baseUrl = serverUrl || 'http://localhost:3000';
    // const baseUrl = 'http://localhost:3000';
    const url = new URL('/api/space', baseUrl);
    url.searchParams.set('spaceName', spaceName);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const { settings }: { settings: SpaceInfo } = await response.json();
    // 根据 /api/space 的返回格式判断空间是否存在
    // 假设返回的数据结构中有空间信息，则表示存在
    return Object.keys(settings.participants || {}).length > 0;
  } catch (error) {
    console.error('Failed to check space existence:', error);
    return false;
  }
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
    const existSpace = await isSpaceExist(spaceName || '');
    if (!existSpace) {
      // 测试得出没有每次都获取新的config，所以重新获取一次配置
      const { create_space, whiteList } = getConfig();

      // 从配置中查询是否允许用户创建房间以及白名单检查
      if (create_space === 'white') {
        if (!verifyWhitList(participantName || '', uIdentity, whiteList)) {
          throw new Error(
            'Creation failed: you are not in the white list. You are not allowed to create space.',
          );
        }
      } else if (create_space === 'white_platform') {
        console.warn('white platform creation mode is not implemented yet.', uIdentity);
        // 没有auth验证白名单
        if (!uIdentity && !verifyWhitList(participantName || '', uIdentity, whiteList)) {
          throw new Error(
            'Creation failed: you are not in the white list. You are not allowed to create space.',
          );
        }
      }
    }

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 },
    );
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
