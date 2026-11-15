import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ConnectionState } from 'livekit-client';
import { DEFAULT_SPACE_INFO } from '@vocespace/domain/space';
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/components/Controller/hooks/index', () => ({ useRoomSubscription: () => {} }));
vi.mock('@/lib/api', () => ({ api: { handleTilePlayerFile: mocks.list } }));
vi.mock('@/lib/realtime/socket', () => ({ socket: { on: vi.fn(), off: vi.fn() } }));
vi.mock('@/lib/store', () => ({ useUserStore: { setState: vi.fn() } }));
import { useConferenceMembership } from '../apps/web/components/Layout/conference/hooks/useConferenceMembership';
const players = [
  { id: 'iframe', mode: 'iframe' },
  { id: 'browser', mode: 'hyperbeam' },
];
const response = (data: unknown) => ({ ok: true, json: async () => data });
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('keeps tool tiles mounted across reconnect, rejects malformed refreshes, and clears on a real room switch', async () => {
  mocks.list.mockResolvedValue(response({ players }));
  const space = {
    name: 'test',
    state: ConnectionState.Connected,
    localParticipant: { identity: 'self', on: vi.fn(), off: vi.fn() },
  };
  const settings = DEFAULT_SPACE_INFO(0, false);
  const context = {
    space,
    settings,
    fetchSettings: vi.fn(),
    setLocalTrackVersion: vi.fn(),
  } as unknown as Parameters<typeof useConferenceMembership>[0];
  const view = renderHook(({ value }) => useConferenceMembership(value), {
    initialProps: { value: context },
  });
  await act(async () => {});
  expect(view.result.current.tilePlayerItems).toEqual(players);
  space.state = ConnectionState.Reconnecting;
  view.rerender({ value: { ...context } });
  expect(view.result.current.selfRoom?.name).toBe('test');
  expect(view.result.current.tilePlayerItems).toEqual(players);
  space.state = ConnectionState.Connected;
  view.rerender({ value: { ...context } });
  expect(mocks.list).toHaveBeenCalledTimes(1);
  mocks.list.mockResolvedValue(response({}));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => {
    await view.result.current.fetchTilePlayers();
  });
  expect(view.result.current.tilePlayerItems).toEqual(players);
  log.mockRestore();
  mocks.list.mockImplementation(() => new Promise(() => {}));
  view.rerender({
    value: {
      ...context,
      settings: {
        ...settings,
        children: [{ name: 'child', participants: ['self'], ownerId: 'self', isPrivate: false }],
      },
    },
  });
  expect(view.result.current.tilePlayerItems).toEqual([]);
});
