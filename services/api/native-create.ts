import { randomBytes } from 'node:crypto';
import { DEFAULT_SPACE_INFO } from '@vocespace/domain/space';
import { StorageUnavailableError } from '@vocespace/server-core';
import { AccessError, safeSegment } from './access';
import { requireNative } from './native-auth';
import { ApiRequest, ApiResponse } from './http';
import { getSpaceRedisClient } from './lib/server/space-redis';
import { getConfig } from './lib/server/config';

export const nativeOwnerKey = (session: string, space: string) =>
  `v1:native-owner:${session}:${space}`;

/** Creation owns no RTC/member until the normal prepare/confirm handshake succeeds. */
export async function nativeCreateEndpoint(request: ApiRequest) {
  const { token, principal } = await requireNative(request);
  const body = await request.json();
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== 'spaceName') ||
    !safeSegment(body.spaceName)
  )
    throw new AccessError(400, 'INVALID_SPACE');
  const name = body.spaceName.trim();
  if (!safeSegment(name)) throw new AccessError(400, 'INVALID_SPACE');
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  const conf = getConfig();
  // An anonymous nickname is not a verified whitelist/platform identity.
  const allowed =
    conf.create_space === 'all' ||
    (['white', 'white_platform'].includes(conf.create_space) && conf.whiteList?.includes('*'));
  const identity = `native_${randomBytes(12).toString('hex')}`;
  const space = { ...structuredClone(DEFAULT_SPACE_INFO(Date.now(), true)), ownerId: identity };
  const result = await redis.eval(
    `
    if redis.call('EXISTS',KEYS[1])==0 then return -2 end
    if redis.call('EXISTS',KEYS[2])==1 then return 0 end
    if ARGV[1]~='1' then return -1 end
    redis.call('SET',KEYS[2],ARGV[2]); redis.call('SADD',KEYS[3],ARGV[3])
    redis.call('SET',KEYS[4],ARGV[4],'EX',ARGV[5]); return 1`,
    4,
    `v1:session:${token}`,
    `space:${name}`,
    'space:list:',
    nativeOwnerKey(principal.id, name),
    allowed ? '1' : '0',
    JSON.stringify(space),
    name,
    identity,
    Math.max(1, Math.ceil((principal.expiresAt - Date.now()) / 1000)),
  );
  if (result === -2) throw new AccessError(401, 'SESSION_REQUIRED');
  if (result === -1) throw new AccessError(403, 'CREATE_DENIED');
  return ApiResponse.json({ spaceName: name, created: result === 1 });
}
