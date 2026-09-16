import { useEffect } from 'react';
import { socket } from '@/features/room/socket';
import { audio } from '@/features/controls/audio';
import { WsJoinRoom, WsRemove } from '@/features/room/protocol';
import { MessageInstance } from 'antd/es/message/interface';

interface JoinParticipant {
  id: string;
  name: string;
  targetRoom: string;
}

interface UseChannelJoinEventsOptions {
  spaceName: string;
  localParticipantId: string;
  joinModalOpen: boolean;
  agreeJoinRoom: (room: string) => Promise<void>;
  setJoinParticipant: (participant: JoinParticipant | null) => void;
  setJoinModalOpen: (open: boolean) => void;
  messageApi: MessageInstance;
  t: (key: string) => string;
  hideTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  mainHideTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export function useChannelJoinEvents({
  spaceName,
  localParticipantId,
  joinModalOpen,
  agreeJoinRoom,
  setJoinParticipant,
  setJoinModalOpen,
  messageApi,
  t,
  hideTimeoutRef,
  mainHideTimeoutRef,
}: UseChannelJoinEventsOptions) {
  useEffect(() => {
    const handleJoinPrivacyRoomResponse = async (msg: WsJoinRoom) => {
      if (msg.space === spaceName && msg.receiverId === localParticipantId) {
        if (!joinModalOpen) {
          if (msg.confirm === false) {
            messageApi.warning({
              content: t('channel.modal.join.reject'),
            });
            setJoinModalOpen(false);
          } else if (msg.confirm) {
            await agreeJoinRoom(msg.childRoom);
          } else {
            await audio.wave();
            setJoinParticipant({
              id: msg.senderId,
              name: msg.senderName,
              targetRoom: msg.childRoom,
            });
            setJoinModalOpen(true);
          }
        }
      }
    };

    const handleRemovedFromPrivacyRoomResponse = (msg: WsRemove) => {
      if (msg.space === spaceName && msg.participants.includes(localParticipantId)) {
        messageApi.info({
          content: `${t('channel.modal.remove.before')}${msg.childRoom}${t(
            'channel.modal.remove.after',
          )}`,
        });
      }
    };

    socket.on('join_privacy_room_response', handleJoinPrivacyRoomResponse);
    socket.on('removed_from_privacy_room_response', handleRemovedFromPrivacyRoomResponse);

    return () => {
      socket.off('join_privacy_room_response', handleJoinPrivacyRoomResponse);
      socket.off('removed_from_privacy_room_response', handleRemovedFromPrivacyRoomResponse);

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (mainHideTimeoutRef.current) {
        clearTimeout(mainHideTimeoutRef.current);
      }
    };
  }, [
    agreeJoinRoom,
    hideTimeoutRef,
    joinModalOpen,
    localParticipantId,
    mainHideTimeoutRef,
    messageApi,
    setJoinModalOpen,
    setJoinParticipant,
    spaceName,
    t,
  ]);
}
