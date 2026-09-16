import { useCallback } from 'react';
import type { Room } from 'livekit-client';
import { api } from '@/features/api';
import { useRoomStore } from '@/features/room/store';
import { consumeExplicitLeaveIntent } from '@/features/room/leave-intent';
import { disconnectRoomSocket, socket } from '@/features/room/socket';
import type { WsBase, WsTo } from '@/features/room/protocol';

interface UseRoomSessionLifecycleOptions {
  room: Room;
  clearRoom: () => Promise<void>;
  navigateHome: () => void;
  setShouldConfirmLeave: (enabled: boolean) => void;
}

export function useRoomSessionLifecycle({
  room,
  clearRoom,
  navigateHome,
  setShouldConfirmLeave,
}: UseRoomSessionLifecycleOptions) {
  const handleDisconnected = useCallback(async () => {
    setShouldConfirmLeave(false);
    if (!consumeExplicitLeaveIntent()) {
      return;
    }

    const audioElement = document.getElementById('local-in-ear-monitor-audio');
    if (audioElement) {
      audioElement.remove();
    }

    useRoomStore.getState().setRoomStatusList([]);

    socket.emit('mouse_remove', {
      space: room.name,
      senderName: room.localParticipant.name || room.localParticipant.identity,
      senderId: room.localParticipant.identity,
      receiverId: '',
      socketId: '',
    } as WsTo);

    await api.leaveSpace(room.name, room.localParticipant.identity, socket);
    await clearRoom();

    socket.emit('update_user_status', {
      space: room.name,
    } as WsBase);

    disconnectRoomSocket();
    navigateHome();
  }, [clearRoom, navigateHome, room, setShouldConfirmLeave]);

  return {
    handleDisconnected,
  };
}
