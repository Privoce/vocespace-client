import { chatMessageKey, mergeChatMessages } from '@/features/chat/message-key';
import type { createSocketScope } from '@/lib/realtime/socket-scope';
import type { ChatMsgItem } from '@/lib/std/chat';
import { useRoomStore } from '@/lib/store';
import type { Room } from 'livekit-client';
import type { useConferenceState } from '../hooks/useConferenceState';

export function registerChatEvents(context: ReturnType<typeof useConferenceState> & { space: Room }, events: ReturnType<typeof createSocketScope>) {
  const { space, controlsRef } = context;
  const receive = (message: ChatMsgItem) => {
    if (message.roomName !== space.name) return;
    useRoomStore.getState().setChatMsg(previous => {
      if (previous.msgs.some(item => chatMessageKey(item) === chatMessageKey(message))) return previous;
      const unread = message.sender.id !== space.localParticipant.identity && !controlsRef.current?.isChatOpen;
      return { msgs: mergeChatMessages(previous.msgs, [message]), unhandled: controlsRef.current?.isChatOpen ? 0 : previous.unhandled + Number(unread) };
    });
  };
  events.on('chat_msg_response', receive);
  events.on('chat_file_response', receive);
}
