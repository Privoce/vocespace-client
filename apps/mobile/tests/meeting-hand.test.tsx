import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMeetingRoom } from '../src/conference/hooks/useMeetingRoom';
import type { NativeRoomDirectory } from '@vocespace/contracts';
const toast = vi.hoisted(() => ({ info: vi.fn(() => 1), remove: vi.fn() }));
vi.mock('@livekit/react-native', () => ({
  useConnectionState: () => 'connected',
  useParticipants: () => [],
  useTracks: () => [],
}));
vi.mock('@ant-design/react-native/lib/toast', () => ({ default: toast }));
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function fixture() {
  let directory: NativeRoomDirectory = {
    current: 'space',
    rooms: [{ name: 'space', participantIds: ['self'] }],
    participants: { self: { name: 'Self', status: 'online', owner: false, raiseHand: false } },
  };
  let stored: boolean | undefined = false;
  const listeners = new Set<() => void>();
  const media = { invitations: [] };
  const onControl = () => () => {};
  const raise = vi.fn(async (next: boolean) => {
    stored = next;
    return true;
  });
  const room = {
    raw: { localParticipant: { identity: 'self' } },
    subscribeDirectory: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getDirectory: () => directory,
    syncDirectory: async () => {
      directory = {
        ...directory,
        participants: { self: { ...directory.participants!.self, raiseHand: stored } },
      };
      listeners.forEach((fn) => fn());
    },
    media: { subscribe: () => () => {}, getSnapshot: () => media },
  };
  const hook = renderHook(() =>
    useMeetingRoom(
      { chat: { raise, onControl } } as unknown as Parameters<typeof useMeetingRoom>[0],
      room as unknown as Parameters<typeof useMeetingRoom>[1],
    ),
  );
  return {
    ...hook,
    raise,
    stale: () => {
      raise.mockImplementation(async () => {
        stored = undefined;
        return true;
      });
    },
  };
}
it('keeps the acknowledged hand after its toast closes and lowers only after the next confirmed change', async () => {
  const m = fixture();
  await act(async () => {
    await m.result.current.raise();
  });
  expect(m.result.current.raised).toBe(true);
  expect(toast.info).toHaveBeenLastCalledWith(
    'phone_meeting.hand_raised',
    3,
    expect.any(Function),
    false,
  );
  const close = (toast.info.mock.calls.at(-1) as unknown as [string, number, () => void])[2];
  act(close);
  expect(m.result.current.raised).toBe(true);
  m.raise.mockResolvedValueOnce(false);
  await act(async () => {
    await m.result.current.raise();
  });
  expect(m.result.current.raised).toBe(true);
  await act(async () => {
    await m.result.current.raise();
  });
  expect(m.result.current.raised).toBe(false);
});
it('does not report success when an older API acknowledges the event without persisting hand state', async () => {
  const m = fixture();
  m.stale();
  await act(async () => {
    await m.result.current.raise();
  });
  expect(m.result.current.raised).toBe(false);
  expect(toast.info).toHaveBeenLastCalledWith(
    'phone_meeting.hand_failed',
    3,
    expect.any(Function),
    false,
  );
});
