import { acceptRaise, RaiseHandler, rejectRaise } from '@/app/pages/controls/widgets/raise';
import { audio } from '@/lib/audio';
import { socket } from '@/lib/realtime/socket';
import type { createSocketScope } from '@/lib/realtime/socket-scope';
import {
  WsBase,
  WsSender,
  WsTo,
  WsWave
} from '@/lib/std/device';
import { Button } from 'antd';
import type { Room } from 'livekit-client';
import {
  Participant
} from 'livekit-client';
import type { useConferenceState } from '../hooks/useConferenceState';
export function registerSocialEvents(context: ReturnType<typeof useConferenceState> & { space: Room }, events: ReturnType<typeof createSocketScope>, onParticipantDisConnected: (participant: Participant) => Promise<void>) {
  const { noteApi, messageApi, space, t, waveAudioRef, channelRef, settings, updateSettings } = context;
  events.on('wave_response', (msg: WsWave) => {
    if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
      waveAudioRef.current?.play();
      let actions = undefined;
      if (msg.childRoom || msg.inSpace) {
        actions = (
          <Button
            type="primary"
            size="small"
            onClick={async () => {
              if (msg.inSpace) {
                // 加入主房间
                await channelRef.current?.joinMain();
              } else {
                // 加入子房间
                await channelRef.current?.join(msg.childRoom!, space.localParticipant.identity);
              }
              noteApi.destroy();
            }}
          >
            {t('channel.join.title')}
          </Button>
        );
      }

      noteApi.info({
        message: `${msg.senderName} ${t('common.wave_msg')}`,
        actions,
        duration: 10,
      });
    }
  });
  events.on('raise_response', async (msg: WsSender) => {
    if (msg.space === space.name) {
      if (
        space.localParticipant.identity === settings.ownerId &&
        msg.senderId !== space.localParticipant.identity
      ) {
        await audio.raise();

        const wsTo: WsTo = {
          space: space.name,
          senderId: space.localParticipant.identity,
          senderName: space.localParticipant.name || space.localParticipant.identity,
          receiverId: msg.senderId,
          socketId: msg.senderSocketId!, // 这里一定是有这个senderSocketId的
        };

        noteApi?.info({
          message: `${msg.senderName} ${t('more.app.raise.receive')}`,
          duration: 5,
          actions: (
            <RaiseHandler
              onAccept={() => acceptRaise(wsTo)}
              onReject={() => rejectRaise(wsTo)}
            />
          ),
        });
      }
    }
  });
  const raiseHandle = async (msg: WsTo, isReject: boolean) => {
    if (msg.space === space.name && msg.receiverId === space.localParticipant.identity) {
      let msg = t('more.app.raise.handle.accepted');
      if (isReject) msg = t('more.app.raise.handle.rejected');
      messageApi.warning(msg);

      await updateSettings({
        raiseHand: false,
      });

      socket.emit('update_user_status', {
        space: space.name,
      } as WsBase);
    }
  };
  events.on('raise_cancel_response', async (msg: WsTo) => {
    await raiseHandle(msg, true);
  });
  events.on('raise_accept_response', async (msg: WsTo) => {
    if (msg.space !== space.name || msg.receiverId !== space.localParticipant.identity) return;
    await raiseHandle(msg, false);
    // 为用户打开麦克风
    if (!space.localParticipant.isMicrophoneEnabled) {
      await space.localParticipant.setMicrophoneEnabled(true);
    }
  });
}
