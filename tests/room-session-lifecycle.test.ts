import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  emit,
  disconnectRoomSocket,
  leaveSpace,
  consumeExplicitLeaveIntent,
  setRoomStatusList,
} = vi.hoisted(() => ({
  emit: vi.fn(),
  disconnectRoomSocket: vi.fn(),
  leaveSpace: vi.fn(async () => undefined),
  consumeExplicitLeaveIntent: vi.fn(),
  setRoomStatusList: vi.fn(),
}));

vi.mock('@/features/api', () => ({
  api: {
    leaveSpace,
  },
}));

vi.mock('@/features/room/leave-intent', () => ({
  consumeExplicitLeaveIntent,
}));

vi.mock('@/features/room/socket', () => ({
  socket: {
    emit,
  },
  disconnectRoomSocket,
}));

vi.mock('@/features/room/store', () => ({
  useRoomStore: {
    getState: () => ({
      setRoomStatusList,
    }),
  },
}));

import { useRoomSessionLifecycle } from '@/features/room/use-room-session-lifecycle';

function createRoomFixture() {
  return {
    name: 'room-a',
    localParticipant: {
      identity: 'user-1',
      name: 'User One',
    },
  };
}

describe('room session lifecycle', () => {
  beforeEach(() => {
    emit.mockReset();
    disconnectRoomSocket.mockReset();
    leaveSpace.mockClear();
    consumeExplicitLeaveIntent.mockReset();
    setRoomStatusList.mockReset();
    document.body.innerHTML = '';
  });

  it('skips room teardown when disconnection is not explicit', async () => {
    consumeExplicitLeaveIntent.mockReturnValue(false);
    const clearRoom = vi.fn(async () => undefined);
    const navigateHome = vi.fn();
    const setShouldConfirmLeave = vi.fn();

    const { result } = renderHook(() =>
      useRoomSessionLifecycle({
        room: createRoomFixture() as any,
        clearRoom,
        navigateHome,
        setShouldConfirmLeave,
      }),
    );

    await result.current.handleDisconnected();

    expect(setShouldConfirmLeave).toHaveBeenCalledWith(false);
    expect(setRoomStatusList).not.toHaveBeenCalled();
    expect(leaveSpace).not.toHaveBeenCalled();
    expect(disconnectRoomSocket).not.toHaveBeenCalled();
    expect(clearRoom).not.toHaveBeenCalled();
    expect(navigateHome).not.toHaveBeenCalled();
  });

  it('cleans up owned resources when explicit leave is consumed', async () => {
    consumeExplicitLeaveIntent.mockReturnValue(true);
    const clearRoom = vi.fn(async () => undefined);
    const navigateHome = vi.fn();
    const setShouldConfirmLeave = vi.fn();

    const audio = document.createElement('audio');
    audio.id = 'local-in-ear-monitor-audio';
    document.body.appendChild(audio);

    const room = createRoomFixture();

    const { result } = renderHook(() =>
      useRoomSessionLifecycle({
        room: room as any,
        clearRoom,
        navigateHome,
        setShouldConfirmLeave,
      }),
    );

    await result.current.handleDisconnected();

    expect(setShouldConfirmLeave).toHaveBeenCalledWith(false);
    expect(setRoomStatusList).toHaveBeenCalledWith([]);
    expect(emit).toHaveBeenNthCalledWith(1, 'mouse_remove', {
      space: room.name,
      senderName: room.localParticipant.name,
      senderId: room.localParticipant.identity,
      receiverId: '',
      socketId: '',
    });
    expect(leaveSpace).toHaveBeenCalledWith(room.name, room.localParticipant.identity, {
      emit,
    });
    expect(clearRoom).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenNthCalledWith(2, 'update_user_status', {
      space: room.name,
    });
    expect(disconnectRoomSocket).toHaveBeenCalledOnce();
    expect(navigateHome).toHaveBeenCalledOnce();
    expect(document.getElementById('local-in-ear-monitor-audio')).toBeNull();
  });
});
