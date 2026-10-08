// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ enabled: true, constructed: vi.fn(), listener: vi.fn() }));
vi.mock('@/lib/server/config', () => ({ getConfig: () => ({
  redis: { enabled: fixture.enabled, host: 'example.test', port: 6379, db: 0 },
}) }));
vi.mock('ioredis', () => ({ default: class {
  constructor(options: unknown) { fixture.constructed(options); }
  on = fixture.listener;
} }));
import { getSpaceRedisClient } from '@/lib/server/space-redis';
const runtime = globalThis as typeof globalThis & { vocespaceSpaceRedis?: unknown };
beforeEach(() => { delete runtime.vocespaceSpaceRedis; fixture.enabled = true; fixture.constructed.mockClear(); });
afterEach(() => { delete runtime.vocespaceSpaceRedis; });

it('does not construct Redis on import or when disabled', () => {
  expect(fixture.constructed).not.toHaveBeenCalled();
  fixture.enabled = false;
  expect(getSpaceRedisClient()).toBeNull();
  expect(fixture.constructed).not.toHaveBeenCalled();
});

it('shares one lazy client across calls and module reloads', async () => {
  const first = getSpaceRedisClient();
  expect(getSpaceRedisClient()).toBe(first);
  vi.resetModules();
  const reloaded = await import('@/lib/server/space-redis');
  expect(reloaded.getSpaceRedisClient()).toBe(first);
  expect(fixture.constructed).toHaveBeenCalledOnce();
  expect(fixture.constructed).toHaveBeenCalledWith(expect.objectContaining({ lazyConnect: true, maxRetriesPerRequest: 1 }));
});
