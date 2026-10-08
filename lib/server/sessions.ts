import { randomBytes } from 'node:crypto';
import { createSessionService } from '@vocespace/server-core';
import { getSpaceRedisClient } from './space-redis';
import { StorageUnavailableError } from '@vocespace/server-core';

const client = () => { const redis = getSpaceRedisClient(); if (!redis) throw new StorageUnavailableError(); return redis; };
async function storage<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch { throw new StorageUnavailableError(); }
}
export const sessions = createSessionService({
  read: (key) => storage(() => client().get(`v1:${key}`)),
  async write(key, value, ttl, existingOnly) {
    if (!existingOnly) { await storage(() => client().set(`v1:${key}`, value, 'EX', ttl)); return; }
    // Merge room bindings atomically; a delayed request must never recreate a revoked session.
    const saved = await storage(() => client().eval(`
      local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end
      local old=cjson.decode(raw); local incoming=cjson.decode(ARGV[1])
      for room,id in pairs(old.identities) do
        if incoming.identities[room]==nil then incoming.identities[room]=id end
      end
      redis.call('SET',KEYS[1],cjson.encode(incoming),'EX',ARGV[2]); return 1`,
      1, `v1:${key}`, value, ttl));
    if (saved !== 1) throw new StorageUnavailableError();
  },
  async consume(key) {
    return await storage(() => client().eval("local v=redis.call('GET',KEYS[1]); redis.call('DEL',KEYS[1]); return v", 1, `v1:${key}`)) as string | null;
  },
  async remove(key) { await storage(() => client().del(`v1:${key}`)); },
}, () => randomBytes(32).toString('hex'));
export const SESSION_COOKIE = 'vocespace_session';
export function sessionToken(headers: Headers) {
  const bearer = headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7);
  return headers.get('cookie')?.split(';').map((v) => v.trim())
    .find((v) => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
}
export function sessionCookie(token: string, url: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(url).protocol === 'https:' ? '; Secure' : ''}`;
}
