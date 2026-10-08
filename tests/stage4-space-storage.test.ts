// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpaceRepository, StorageUnavailableError } from '@vocespace/server-core';

vi.mock('@/lib/server/space-files', () => ({ removeSpaceFiles: vi.fn() }));
const state = vi.hoisted(() => ({
  values: new Map<string, string>(),
  sets: new Map<string, Set<string>>(),
  enabled: true,
  fail: false,
}));
vi.mock('@/lib/server/config', () => ({
  getConfig: () => ({ create_space: 'all', whiteList: [] }),
}));
vi.mock('@/lib/server/space-redis', () => {
  const client = {
    get: async (key: string) => {
      if (state.fail) throw new Error('private infrastructure failure');
      return state.values.get(key) ?? null;
    },
    set: async (key: string, value: string) => { state.values.set(key, value); return 'OK'; },
    exists: async (key: string) => state.values.has(key) ? 1 : 0,
    del: async (key: string) => Number(state.values.delete(key)),
    sadd: async (key: string, value: string) => {
      const set = state.sets.get(key) ?? new Set();
      set.add(value); state.sets.set(key, set); return 1;
    },
    srem: async (key: string, value: string) => Number(state.sets.get(key)?.delete(value)),
    smembers: async (key: string) => [...(state.sets.get(key) ?? [])],
    multi: () => transaction(),
    pipeline: () => transaction(),
  };
  function transaction() {
    const operations: Array<() => Promise<unknown>> = [];
    const tx = {
      set(key: string, value: string) { operations.push(() => client.set(key, value)); return tx; },
      sadd(key: string, value: string) { operations.push(() => client.sadd(key, value)); return tx; },
      srem(key: string, value: string) { operations.push(() => client.srem(key, value)); return tx; },
      del(key: string) { operations.push(() => client.del(key)); return tx; },
      async exec() {
        if (state.fail) return [[new Error('command failed'), null]];
        return Promise.all(operations.map(async (operation) => [null, await operation()]));
      },
    };
    return tx;
  }
  return { getSpaceRedisClient: () => state.enabled ? client : null };
});

import { spaceRepository } from '@/lib/server/space-repository';
import { SpaceManager } from '@/lib/server/legacy-space-manager';
import { DEFAULT_PARTICIPANT_SETTINGS, DEFAULT_SPACE_INFO } from '@/lib/std/space';

beforeEach(() => {
  state.values.clear(); state.sets.clear(); state.enabled = true; state.fail = false;
});

describe('Space persistence migration', () => {
  it('reads existing legacy keys and shares writes with the legacy manager', async () => {
    const space = DEFAULT_SPACE_INFO(123, true);
    state.values.set('space:room', JSON.stringify(space));
    expect(await spaceRepository.get('room')).toEqual(space);
    space.ownerId = 'alice';
    expect(await SpaceManager.setSpaceInfo('room', space)).toBe(true);
    expect(await spaceRepository.get('room')).toEqual(space);
    expect(await SpaceManager.getAllSpaces()).toEqual({ room: space });
    expect(state.sets.get('space:list:')).toEqual(new Set(['room']));
  });

  it('distinguishes missing records, disabled Redis, failures and corrupt data', async () => {
    expect(await spaceRepository.get('missing')).toBeNull();
    state.enabled = false;
    await expect(spaceRepository.get('room')).rejects.toBeInstanceOf(StorageUnavailableError);
    state.enabled = true; state.fail = true;
    await expect(spaceRepository.get('room')).rejects.toThrow('Space storage is unavailable');
    state.fail = false;
    for (const invalid of ['{broken-private-content', '[]', '{"participants":null}']) {
      state.values.set('space:room', invalid);
      await expect(spaceRepository.get('room')).rejects.toThrow('Space storage is unavailable');
    }
  });

  it('does not report success when the Redis transaction returns a command error', async () => {
    state.fail = true;
    await expect(spaceRepository.save('room', DEFAULT_SPACE_INFO(1, false)))
      .rejects.toBeInstanceOf(StorageUnavailableError);
  });

  it('lists special names without prototype mutation and ignores stale index entries', async () => {
    await spaceRepository.save('__proto__', DEFAULT_SPACE_INFO(1, false));
    state.sets.get('space:list:')!.add('removed');
    const spaces = await spaceRepository.list();
    expect(Object.keys(spaces)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(spaces)).toBeNull();
  });

  it('keeps member, ownership and subroom operations compatible after class extraction', async () => {
    const participant = () => structuredClone(DEFAULT_PARTICIPANT_SETTINGS);
    const alice = { ...participant(), name: 'Alice', startAt: 100 };
    expect(await SpaceManager.updateParticipant('room', 'alice', alice)).toBe(true);
    expect((await spaceRepository.get('room'))?.ownerId).toBe('alice');
    const bob = { ...participant(), name: 'Bob', startAt: 200 };
    expect(await SpaceManager.updateParticipant('room', 'bob', bob)).toBe(true);
    expect(await SpaceManager.transferOwner('room', 'bob')).toBe(true);
    expect((await spaceRepository.get('room'))?.participants.bob.auth?.identity).toBe('owner');
    expect((await SpaceManager.switchChildRoomPrivacy('room', 'Meeting Room', true)).success).toBe(true);
    expect((await spaceRepository.get('room'))?.children[0].isPrivate).toBe(true);
    expect((await SpaceManager.removeParticipant('room', 'alice')).success).toBe(true);
    expect((await spaceRepository.get('room'))?.participants.alice).toBeUndefined();
    expect(state.values.has('space:date:records:room')).toBe(true);
  });

  it('keeps temporary room removal and history updates on the existing storage', async () => {
    const space = DEFAULT_SPACE_INFO(1, false);
    space.persistence = false;
    space.ownerId = 'alice';
    space.participants.alice = { ...structuredClone(DEFAULT_PARTICIPANT_SETTINGS), name: 'Alice' };
    await spaceRepository.save('room', space);
    state.values.set('chat:room', '[]');
    expect(await SpaceManager.removeParticipant('room', 'alice')).toMatchObject({ success: true, clearAll: true });
    expect(await spaceRepository.get('room')).toBeNull();
    expect(state.values.has('chat:room')).toBe(false);
    expect(state.sets.get('space:list:')?.has('room')).toBe(false);
  });
});

it('keeps the core repository independent of Redis and preserves adapter failures', async () => {
  const repository = createSpaceRepository({
    read: async () => { throw new StorageUnavailableError(); },
    writeAndIndex: vi.fn(), names: async () => [],
  }, (value) => value);
  await expect(repository.get('room')).rejects.toBeInstanceOf(StorageUnavailableError);
});
