import { AccountError, canCreateSpace, createAccountService, StorageUnavailableError } from '@vocespace/server-core';
import { accountObject } from '@vocespace/contracts';
import { accountConfig, createSupabaseAccountProvider } from './account/supabase';
import { accountFlows } from './account/flow-store';
import { AccessError, safeSegment } from './access';
import { ApiRequest, ApiResponse } from './http';
import { getConfig } from './lib/server/config';
import { getSpaceRedisClient } from './lib/server/space-redis';
import { sessions } from './lib/server/sessions';
import { DEFAULT_SPACE_INFO } from '@vocespace/domain/space';
import { publicLiveSpaces } from './native-directory';

/** Browser platform integration; verified account identity is never supplied by the caller. */
export async function platformEndpoint(request: ApiRequest, action: string) {
  try {
    const conf = getConfig();
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' ||
        origin && origin !== conf.deployment.platform.publicOrigin)
      throw new AccessError(403, 'ORIGIN_DENIED');
    if (action === 'spaces' && request.method === 'GET') return ApiResponse.json(await publicLiveSpaces());
    if (!['entry', 'create'].includes(action)) throw new AccessError(404, 'NOT_FOUND');
    if (request.method !== 'POST') throw new AccessError(405, 'METHOD_NOT_ALLOWED');
    if (origin !== conf.deployment.platform.publicOrigin || request.headers.get('x-vocespace-request') !== '1')
      throw new AccessError(403, 'ORIGIN_DENIED');
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!token || token.length > 16384) throw new AccessError(401, 'AUTH_SESSION_REQUIRED');
    const user = await createAccountService(createSupabaseAccountProvider(accountConfig())).me(token);
    if (!(await accountFlows.allow(`platform:${user.id}`, 60))) throw new AccessError(429, 'AUTH_RATE_LIMITED');
    const body = accountObject(await request.json());
    if (Object.keys(body).some(key => key !== 'spaceName') || !safeSegment(body.spaceName))
      throw new AccessError(400, 'INVALID_SPACE');
    const name = body.spaceName;
    if (action === 'create') {
      if (!canCreateSpace({ mode: conf.create_space, name: user.username || user.email, platformIdentity: user.id, whiteList: conf.whiteList }))
        throw new AccessError(403, 'CREATE_DENIED');
      const redis = getSpaceRedisClient();
      if (!redis) throw new StorageUnavailableError();
      const space = { ...structuredClone(DEFAULT_SPACE_INFO(Date.now(), true)), ownerId: user.id };
      const created = await redis.eval("if redis.call('EXISTS',KEYS[1])==1 then return 0 end redis.call('SET',KEYS[1],ARGV[1]); redis.call('SADD',KEYS[2],ARGV[2]); return 1", 2,
        `space:${name}`, 'space:list:', JSON.stringify(space), name);
      return ApiResponse.json({ success: created === 1, ...(created === 1 ? {} : { error: 'SPACE_EXISTS' }) }, { status: created === 1 ? 200 : 409 });
    }
    const now = Math.floor(Date.now() / 1000);
    const code = await sessions.code({ id: user.id, username: user.username || user.email, avatar: user.avatar,
      space: name, auth: 'vocespace', identity: 'participant', iat: now, exp: now + 3600 });
    const url = new URL(`${conf.deployment.basePath}/${encodeURIComponent(name)}`, conf.deployment.publicOrigin);
    url.searchParams.set('code', code);
    return ApiResponse.json({ redirectUrl: url.toString() }, { headers: { 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    if (error instanceof AccountError) return ApiResponse.json({ code: error.code }, { status: error.status });
    throw error;
  }
}
