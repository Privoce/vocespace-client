import { getSpaceRedisClient } from '../lib/server/space-redis';
import { StorageUnavailableError } from '@vocespace/server-core';
/** One-time email flows only; never persisted in browser or app storage. */
export const accountFlows = {
  async allow(key: string, max: number) {
    try {
      const redis = getSpaceRedisClient();
      if (!redis) throw new Error();
      const count = await redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1,
        `v1:account-rate:${key}`,
      );
      return Number(count) <= max;
    } catch {
      throw new StorageUnavailableError();
    }
  },
  async write(key: string, value: unknown, ttl: number) {
    try {
      const redis = getSpaceRedisClient();
      if (!redis) throw new Error();
      await redis.set(`v1:account-flow:${key}`, JSON.stringify(value), 'EX', ttl);
    } catch {
      throw new StorageUnavailableError();
    }
  },
  async take(key: string): Promise<unknown> {
    if (!/^[a-f0-9]{64}$/.test(key)) return null;
    try {
      const redis = getSpaceRedisClient();
      if (!redis) throw new Error();
      const raw = await redis.eval(
        "local v=redis.call('GET',KEYS[1]); redis.call('DEL',KEYS[1]); return v",
        1,
        `v1:account-flow:${key}`,
      );
      return typeof raw === 'string' ? JSON.parse(raw) : null;
    } catch {
      throw new StorageUnavailableError();
    }
  },
  async read(key: string): Promise<unknown> {
    if (!/^[a-f0-9]{64}$/.test(key)) return null;
    try {
      const redis = getSpaceRedisClient();
      if (!redis) throw new Error();
      const raw = await redis.get(`v1:account-flow:${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      throw new StorageUnavailableError();
    }
  },
};
