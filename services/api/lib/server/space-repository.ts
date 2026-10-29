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

export const saveSpaceWithCreation = (name: string, json: string) =>
  storageOperation(async () => {
    // Keep the existing keys. CAS updates the write and list index atomically.
    // A persistent epoch invalidates already-produced HLS on every child membership change,
    // including moving into a Room and returning before the next preview poll.
    for (let attempt = 0; attempt < 5; attempt++) {
      const previous = await client().get(`${SPACE_KEY_PREFIX}${name}`);
      const old: SpaceInfo | null = previous ? JSON.parse(previous) : null;
      const next: SpaceInfo = JSON.parse(json);
      // Stale preference/heartbeat writes must never erase bans or resurrect removed members.
      next.blacklist = [...new Set([...(old?.blacklist || []), ...(next.blacklist || [])])];
      for (const id of next.blacklist) delete next.participants[id];
      next.managers = next.managers.filter((id) => !next.blacklist.includes(id));
      for (const child of next.children)
        child.participants = child.participants.filter((id) => !next.blacklist.includes(id));
      const groups = (space: SpaceInfo | null) =>
        space?.children.map((child) => [child.name, [...child.participants].sort()]).sort() || null;
      const changed = JSON.stringify(groups(old)) !== JSON.stringify(groups(next));
      const saved = await client().eval(
        `
        local raw=redis.call('GET',KEYS[1]) or ''
        if raw~=ARGV[1] then return 0 end
        redis.call('SET',KEYS[1],ARGV[2]); redis.call('SADD',KEYS[2],ARGV[3])
        if ARGV[4]=='1' then redis.call('SET',KEYS[3],ARGV[5]) end
        return 1`,
        3,
        `${SPACE_KEY_PREFIX}${name}`,
        SPACE_LIST_KEY,
        `v1:preview:epoch:${name}`,
        previous || '',
        JSON.stringify(next),
        name,
        changed ? '1' : '0',
        randomUUID(),
      );
      if (saved === 1) return previous === null;
    }
    throw new StorageUnavailableError();
  });

export const spaceRepository = createSpaceRepository<SpaceInfo>(
  {
    read: (name) => storageOperation(() => client().get(`${SPACE_KEY_PREFIX}${name}`)),
    names: () => storageOperation(() => client().smembers(SPACE_LIST_KEY)),
    writeAndIndex: async (name, json) => {
      await saveSpaceWithCreation(name, json);
    },
  },
  (value) => {
    // Minimal legacy storage validation. Full nested DTO migration is tracked separately.
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !('participants' in value) ||
      !value.participants ||
      typeof value.participants !== 'object' ||
      Array.isArray(value.participants)
    ) {
      throw new StorageUnavailableError();
    }
    const space = value as SpaceInfo;
    space.blacklist ||= [];
    if (!Array.isArray(space.blacklist) || space.blacklist.some((id) => typeof id !== 'string'))
      throw new StorageUnavailableError();
    return space;
  },
);
