import { socket } from '@/lib/realtime/socket';
import type { createSocketScope } from '@/lib/realtime/socket-scope';
import { markExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import {
  ControlType,
  WsBase,
  WsControlParticipant,
  WsInviteDevice,
  WsTo
} from '@/lib/std/device';
import { Button } from 'antd';
import type { Room } from 'livekit-client';
import {
  LocalTrackPublication,
  Participant,
  Track
} from 'livekit-client';
import type { useConferenceState } from '../hooks/useConferenceState';
export function registerModerationEvents(context: ReturnType<typeof useConferenceState> & { space: Room }, events: ReturnType<typeof createSocketScope>, onParticipantDisConnected: (participant: Participant) => Promise<void>) {
  const {
    layoutContext,
    noteApi,
    messageApi,
    space,
    t,
    settings,
    updateSettings,
    transOrSetOwnerManager,
    device,
  } = context;
  events.on('invite_device_response', (msg: WsInviteDevice) => {
    if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
      let device_str;
      let open: () => Promise<LocalTrackPublication | undefined>;
      switch (msg.device) {
        case Track.Source.Camera:
          device_str = 'common.device.camera';
          open = () => space.localParticipant.setCameraEnabled(msg.isOpen);
          break;
        case Track.Source.Microphone:
          device_str = 'common.device.microphone';
          open = () => space.localParticipant.setMicrophoneEnabled(msg.isOpen);
          break;
        case Track.Source.ScreenShare:
          device_str = 'common.device.screen';
          open = () => space.localParticipant.setScreenShareEnabled(msg.isOpen);
          break;
        default:
          return;
      }

      const actions = (
        <Button
          type="primary"
          size="small"
          onClick={async () => {
            await open();
            noteApi.destroy();
          }}
        >
          {t(`common.${msg.isOpen ? 'open' : 'close'}`)}
        </Button>
      );

      noteApi.info({
        message: `${msg.senderName} ${t('msg.info.invite_device')} ${t(device_str)}`,
        duration: 5,
        actions,
      });
    }
  });
  events.on('remove_participant_response', async (msg: WsTo) => {
    if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
      let participant = space.localParticipant;
      messageApi.error({
        content: t('msg.info.remove_participant'),
        duration: 3,
      });
      markExplicitLeaveIntent();
      space.disconnect(true);
      await onParticipantDisConnected(participant);
    }
  });
  events.on('control_participant_response', async (msg: WsControlParticipant) => {
    if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
      switch (msg.type) {
        case ControlType.ChangeName: {
          await space.localParticipant?.setMetadata(JSON.stringify({ name: msg.username! }));
          await space.localParticipant.setName(msg.username!);
          await updateSettings({
            name: msg.username!,
          });
          messageApi.success(t('msg.success.user.username.change'));
          socket.emit('update_user_status', {
            space: space.name,
          } as WsBase);
          break;
        }
        case ControlType.MuteAudio: {
          await space.localParticipant.setMicrophoneEnabled(false);
          messageApi.success(t('msg.success.device.mute.audio'));
          break;
        }
        case ControlType.MuteVideo: {
          await space.localParticipant.setCameraEnabled(false);
          messageApi.success(t('msg.success.device.mute.video'));
          break;
        }
        case ControlType.MuteScreen: {
          await space.localParticipant.setScreenShareEnabled(false);
          messageApi.success(t('msg.success.device.mute.screen'));
          break;
        }
        case ControlType.Transfer: {
          const success = await transOrSetOwnerManager(
            msg.senderId,
            space.localParticipant.identity,
            true,
          );
          if (success) {
            // 更新视图
            layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
            messageApi.success(t('msg.success.user.transfer'));
          }
          socket.emit('update_user_status', {
            space: space.name,
          } as WsBase);
          break;
        }
        case ControlType.setManager: {
          if (settings.managers.length < 5) {
            const { success, isRemove } = await transOrSetOwnerManager(
              msg.senderId,
              space.localParticipant.identity,
              false,
            );
            if (success) {
              layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
              if (isRemove) {
                messageApi.success(t('msg.success.user.remove_manager'));
              } else {
                messageApi.success(t('msg.success.user.set_manager'));
              }
            }
            socket.emit('update_user_status', {
              space: space.name,
            } as WsBase);
          } else {
            messageApi.error(t('msg.error.user.manager_limit'));
          }
          break;
        }
        case ControlType.Volume: {
          await updateSettings({
            volume: msg.volume!,
          });
          socket.emit('update_user_status', {
            space: space.name,
          } as WsBase);
          break;
        }
        case ControlType.BlurVideo: {
          await updateSettings({
            blur: msg.blur!,
          });
          socket.emit('update_user_status', {
            space: space.name,
          } as WsBase);
          break;
        }
        case ControlType.BlurScreen: {
          await updateSettings({
            screenBlur: msg.blur!,
          });
          socket.emit('update_user_status', {
            space: space.name,
          } as WsBase);
          break;
        }
      }
    }
  });
  events.on('req_record_response', (msg: WsTo) => {
    if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
      noteApi.info({
        message: `${msg.senderName} ${t('msg.info.req_record')}`,
        duration: 5,
      });
    }
  });
  events.on('recording_response', (msg: WsBase) => {
    if (msg.space === space.name) {
      noteApi.warning({
        message: t('msg.info.recording'),
        actions: (
          <Button
            color="danger"
            size="small"
            onClick={async () => {
              markExplicitLeaveIntent();
              space.disconnect(true);
            }}
          >
            {t('common.leave')}
          </Button>
        ),
      });
    }
  });
}
