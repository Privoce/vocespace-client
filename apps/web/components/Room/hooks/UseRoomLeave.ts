'use client';

import { api } from '@/lib/api';
import { socket } from '@/lib/realtime/socket';
import { clearExplicitLeaveIntent,consumeExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import { useRoomStore } from '@/lib/store/room';
import { useSpaceStore } from '@/lib/store/space';
import type { Room } from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useCallback,useEffect,type RefObject } from 'react';

function clearSessionState() {
  const state = useRoomStore.getInitialState();
  useRoomStore.setState(state);
  useSpaceStore.setState({ roomIdTmp: '', isFocus: false, isFullScreen: false });
  document.getElementById('local-in-ear-monitor-audio')?.remove();
}

export function useRoomLeave(room: Room, view: RefObject<{ clearRoom: () => Promise<void> }>,
  setShouldConfirmLeave: (value: boolean) => void) {
  const router = useRouter();
  useEffect(() => {
    clearExplicitLeaveIntent();
    return () => { clearExplicitLeaveIntent(); clearSessionState(); };
  }, [room]);

  return useCallback(async () => {
    setShouldConfirmLeave(false);
    // Network interruption must not delete membership or navigate away.
    if (!consumeExplicitLeaveIntent()) return;
    clearSessionState();
    socket.emit('mouse_remove', { space: room.name, senderName: room.localParticipant.name || room.localParticipant.identity,
      senderId: room.localParticipant.identity, receiverId: '', socketId: '' });
    try {
      await api.leaveSpace(room.name, room.localParticipant.identity, socket);
      await view.current?.clearRoom();
      socket.emit('update_user_status', { space: room.name });
    } catch (error) {
      console.error('Room leave cleanup failed', error);
    } finally {
      router.replace('/');
    }
  }, [room, router, view, setShouldConfirmLeave]);
}
