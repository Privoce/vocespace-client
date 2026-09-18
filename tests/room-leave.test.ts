import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Room } from 'livekit-client';

const mocks = vi.hoisted(() => ({ replace: vi.fn(), leaveSpace: vi.fn(), emit: vi.fn(), reset: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/api', () => ({ api: { leaveSpace: mocks.leaveSpace } }));
vi.mock('@/lib/realtime/socket', () => ({ socket: { emit: mocks.emit } }));
vi.mock('@/lib/store/room', () => ({ useRoomStore: { getInitialState: () => ({}), setState: mocks.reset } }));
vi.mock('@/lib/store/space', () => ({ useSpaceStore: { setState: vi.fn() } }));
import { useRoomLeave } from '@/features/room/hooks/use-room-leave';
import { markExplicitLeaveIntent, clearExplicitLeaveIntent } from '@/lib/roomLeaveIntent';

afterEach(() => { cleanup(); clearExplicitLeaveIntent(); });
const room = { name: 'test-room', localParticipant: { name: 'Alice', identity: 'test-user' } } as Room;
it('does not delete membership or navigate on an unexpected disconnect', async () => {
  const { result } = renderHook(() => useRoomLeave(room, { current: null }, vi.fn()));
  await act(async () => { await result.current(); });
  expect(mocks.leaveSpace).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.reset).not.toHaveBeenCalled();
});
it('handles explicit departure once and still exits if server cleanup fails', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.leaveSpace.mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useRoomLeave(room, { current: null }, vi.fn()));
  markExplicitLeaveIntent();
  await act(async () => { await result.current(); await result.current(); });
  expect(mocks.leaveSpace).toHaveBeenCalledTimes(1);
  expect(mocks.replace).toHaveBeenCalledWith('/');
  error.mockRestore();
});
