'use client';

import { socket } from '@/lib/realtime/socket';
import { createSocketScope } from '@/lib/realtime/socket-scope';
import { markExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import { UserDefineStatus } from '@/lib/std';
import {
  WsBase,
  WsParticipant,
  WsTo
} from '@/lib/std/device';
import { useRoomStore } from '@/lib/store';
import {
  ConnectionState,
  Participant,
  ParticipantEvent,
  RoomEvent,
  Track,
  TrackPublication
} from 'livekit-client';
import {
  useEffect
} from 'react';
import { registerChatEvents } from '../events/registerChatEvents';
import { registerModerationEvents } from '../events/registerModerationEvents';
import { registerSocialEvents } from '../events/registerSocialEvents';
import { useConferenceInitialization } from './useConferenceInitialization';
import type { useConferenceState } from './useConferenceState';

export function useConferenceEvents(context: ReturnType<typeof useConferenceState>) {
  useConferenceInitialization(context);
  useEffect(() => {
    const {
      messageApi,
      config,
      space,
      setInit,
      t,
      uState,
      uLicenseState,
      promptSoundRef,
      settings,
      updateSettings,
      fetchSettings,
      clearSettings,
    } = context;
    if (!space) return;
    if (
      space.state === ConnectionState.Connecting ||
      space.state === ConnectionState.Reconnecting
    ) {
      setInit(true);
      return;
    } else if (space.state !== ConnectionState.Connected) {
      return;
    }
    const events = createSocketScope(socket);
    // 当socket需要重连时 ------------------------------------------------------------------------
    events.on('connect', () => {
      console.warn('Socket connect/reconnected:', socket.id);
      setInit(true);
    });

    // 从平台端获取数据 ai总结/todos (moved to useAICutService hook)

    // 获取历史聊天记录 ---------------------------------------------------------------------------

    // 从config中获取license进行校验 -------------------------------------------------------------------

    // 重写初始化用户 -----------------------------------------------------------------------------
    events.on('re_init_response', async (msg: WsParticipant) => {
      if (msg.space === space.name && msg.participantId === space.localParticipant.identity) {
        // 只有在用户没有正常初始化时才会触发
        setInit(true);
      }
    });

    // 监听服务器的提醒事件的响应 -------------------------------------------------------------------

    // 监听服务器的用户状态更新事件 -------------------------------------------------------------------
    events.on('user_status_updated', async (msg: WsBase) => {
      // 调用fetchSettings
      // 另一个环境是没有参数的，可能导致错误，所以这里强制判断msg
      if (msg && msg.space && msg.space === space.name) {
        await fetchSettings();
      }
    });

    // 房间事件监听器 --------------------------------------------------------------------------------
    const onParticipantConnected = async (participant: Participant) => {
      // 通过许可证判断人数
      if (space.remoteParticipants.size >= uLicenseState.space.personLimit - 1) {
        if (space.localParticipant.identity === participant.identity) {
          messageApi.error({
            content: t('common.full_user'),
            duration: 3,
          });
          markExplicitLeaveIntent();
          space.disconnect(true);
        }
        return;
      }
      // 参与者进入之后发出提示音
      if (uState.openPromptSound && promptSoundRef.current) {
        promptSoundRef.current.play();
      }
    };
    const onParticipantDisConnected = async (participant: Participant) => {
      socket.emit('mouse_remove', {
        space: space.name,
        senderName: participant.name || participant.identity,
        senderId: participant.identity,
        receiverId: '',
        socketId: '',
      } as WsTo);
      // do clearSettings but use leave participant
      await clearSettings(participant.identity);
    };
    // 监听远程参与者连接事件 --------------------------------------------------------------------------
    space.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    // space.on(RoomEvent.TrackSub)
    // 监听本地用户开关摄像头事件 ----------------------------------------------------------------------
    const onTrackHandler = (track: TrackPublication) => {
      if (track.source === Track.Source.Camera) {
        // 需要判断虚拟形象是否开启，若开启则需要关闭
        if (
          uState.virtual.enabled ||
          settings.participants[space.localParticipant.identity]?.virtual.enabled
        ) {
          updateSettings({
            virtual: {
              ...uState.virtual,
              enabled: false,
            },
          }).then(() => {
            socket.emit('update_user_status', {
              space: space.name,
            } as WsBase);
          });
        }
      }
    };

    // [用户定义新状态] ----------------------------------------------------------------------
    events.on(
      'new_user_status_response',
      (msg: { status: UserDefineStatus[]; space: string }) => {
        if (space.name === msg.space) {
          useRoomStore.getState().setRoomStatusList(msg.status);
        }
      },
    );

    space.localParticipant.on(ParticipantEvent.TrackMuted, onTrackHandler);
    space.on(RoomEvent.ParticipantDisconnected, onParticipantDisConnected);

    // [用户邀请事件] -------------------------------------------------------------------------

    // [用户被移除出房间] ----------------------------------------------------------------

    // [用户控制事件] -------------------------------------------------------------------

    // [参与者请求主持人录屏] ---------------------------------------------------

    // [主持人进行了录屏，询问参会者是否还要呆在房间] -----------------------------------

    // [重新fetch room，这里有可能是因为房间初始化设置时出现问题] ------------------------
    events.on(
      'refetch_room_response',
      async (msg: {
        space: string;
        reocrd: {
          active: boolean;
          egressId: string;
          filePath: string;
        };
      }) => {
        if (msg.space === space.name) {
          await updateSettings(
            settings.participants[space.localParticipant.identity],
            msg.reocrd,
          );
          socket.emit('update_user_status', {
            space: space.name,
          } as WsBase);
        }
      },
    );
    // [用户获取到其他参与者聊天信息事件] ------------------------------------------------

    // [重载/更新配置] -----------------------------------------------------------------------
    events.on('reload_env_response', (msg: WsBase) => {
      messageApi.success(t('settings.general.conf.reload_env'));
      // 在localstorage中添加一个reload标记，这样退出之后如果有这个标记就可以自动重载
      localStorage.setItem('reload', space.name);
      markExplicitLeaveIntent();
      space.disconnect(true);
    });

    // raise hand socket event ----------------------------------------------

    // cancel raise hand socket event ----------------------------------------------

    // accept raise hand socket event ----------------------------------------------

    registerModerationEvents({ ...context, space }, events, onParticipantDisConnected);
    registerSocialEvents({ ...context, space }, events, onParticipantDisConnected);
    registerChatEvents({ ...context, space }, events);
    return () => {
      events.dispose();
      space.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      space.localParticipant.off(ParticipantEvent.TrackMuted, onTrackHandler);
      space.off(RoomEvent.ParticipantDisconnected, onParticipantDisConnected);
    };
  }, [context]);
  return { ...context, };
}
