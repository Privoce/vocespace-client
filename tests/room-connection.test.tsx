import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const rtc = vi.hoisted(() => ({ rooms: [] as any[], keys: [] as any[] }));
vi.mock('livekit-client', () => ({
  Room: class {
    disconnect = vi.fn(async () => {});
    setE2EEEnabled = vi.fn(async () => {});
    constructor(public options: unknown) { rtc.rooms.push(this); }
  },
  ExternalE2EEKeyProvider: class {
    setKey = vi.fn(async () => {});
    constructor() { rtc.keys.push(this); }
  },
}));
vi.mock('@/lib/std/conf', () => ({ createRTCQulity: () => [{}, {}, {}] }));
import { useRoomConnection } from '@/features/room/hooks/use-room-connection';
import type { ReadableConf } from '@/lib/std/conf';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); rtc.rooms.length = 0; rtc.keys.length = 0; });

it('retains Room and encryption resources on rerender, decodes the key once and releases on unmount', async () => {
  vi.useFakeTimers();
  history.replaceState({}, '', '/space?hq=true#key%25literal');
  const terminate = vi.fn();
  const Worker = vi.fn(function () { return { terminate }; });
  vi.stubGlobal('Worker', Worker);
  const props = { config: { livekit: { turn: [] } } as unknown as ReadableConf,
    userChoices: { username: 'Alice', videoEnabled: false, audioEnabled: false, videoDeviceId: '', audioDeviceId: '' },
    options: { hq: true, codec: 'vp9' as const }, onError: vi.fn() };
  const { result, rerender, unmount } = renderHook(() => useRoomConnection(props));
  await act(async () => {});
  const original = result.current.room;
  rerender();
  expect(result.current.room).toBe(original);
  expect(rtc.rooms).toHaveLength(1);
  expect(Worker).toHaveBeenCalledTimes(1);
  expect(rtc.keys[0].setKey).toHaveBeenCalledWith('key%literal');
  expect(result.current.e2eeSetupComplete).toBe(true);
  expect(terminate).not.toHaveBeenCalled();
  unmount();
  await act(async () => { vi.runAllTimers(); });
  expect(original?.disconnect).toHaveBeenCalledTimes(1);
  expect(terminate).toHaveBeenCalledTimes(1);
});
