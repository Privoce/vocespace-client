import Redis from 'ioredis';
import { getConfig } from '@/lib/server/config';

const runtime = globalThis as typeof globalThis & { vocespaceSpaceRedis?: Redis };

/** One lazy connection for the API process, shared across routes and development reloads. */
export function getSpaceRedisClient(): Redis | null {
  if (runtime.vocespaceSpaceRedis) return runtime.vocespaceSpaceRedis;
  const { redis } = getConfig();
  if (!redis.enabled) return null;
  const client = new Redis({
    host: redis.host,
    port: redis.port,
    password: redis.password,
    db: redis.db,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  client.on('error', () => console.error('Space Redis connection unavailable'));
  runtime.vocespaceSpaceRedis = client;
  return client;
}
