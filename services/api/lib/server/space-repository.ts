import { randomUUID } from 'node:crypto';
import { createSpaceRepository, StorageUnavailableError } from '@vocespace/server-core';
import type { SpaceInfo } from '@vocespace/domain/space';
import { getSpaceRedisClient } from './space-redis';

export const SPACE_KEY_PREFIX = 'space:';
export const SPACE_LIST_KEY = 'space:list:';

function client() {
  const redis = getSpaceRedisClient();
  if (!redis) throw new StorageUnavailableError();
  return redis;
}

async function storageOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    // Do not expose Redis endpoints, credentials or stored content to API consumers.
    throw new StorageUnavailableError();
  }
}

export const spaceRepository = createSpaceRepository<SpaceInfo>({
  read: (name) => storageOperation(() => client().get(`${SPACE_KEY_PREFIX}${name}`)),
  names: () => storageOperation(() => client().smembers(SPACE_LIST_KEY)),
  writeAndIndex: (name, json) => storageOperation(async () => {
    // Keep the existing keys. MULTI keeps the write and list index in one transaction.
    // A persistent epoch invalidates already-produced HLS on every child membership change,
    // including moving into a Room and returning before the next preview poll.
    const previous = await client().get(`${SPACE_KEY_PREFIX}${name}`);
    const groups = (raw: string | null) => {
      const children = raw ? JSON.parse(raw).children : null;
      return Array.isArray(children) ? children.map((child: { name: string; participants: string[] }) =>
        [child.name, Array.isArray(child.participants) ? [...child.participants].sort() : null]).sort() : null;
    };
    const transaction = client().multi();
    if (JSON.stringify(groups(previous)) !== JSON.stringify(groups(json)))
      transaction.set(`v1:preview:epoch:${name}`, randomUUID());
    const results = await transaction
      .set(`${SPACE_KEY_PREFIX}${name}`, json)
      .sadd(SPACE_LIST_KEY, name)
      .exec();
    if (!results || results.some(([error]) => error !== null)) throw new StorageUnavailableError();
  }),
}, (value) => {
  // Minimal legacy storage validation. Full nested DTO migration is tracked separately.
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !('participants' in value) || !value.participants ||
      typeof value.participants !== 'object' || Array.isArray(value.participants)) {
    throw new StorageUnavailableError();
  }
  return value as SpaceInfo;
});
