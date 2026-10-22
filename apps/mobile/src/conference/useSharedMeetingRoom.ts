import { useI18n } from '../i18n';
import { useEffect, useState } from 'react';
import { BackHandler, Clipboard } from 'react-native';
import { isTrackReference } from '@livekit/react-native';
import { Track } from 'livekit-client';
import type { MeetingAction, MeetingTile } from '@vocespace/ui';
import type { useConference } from './useConference';
import type { NativeRoom } from './room';
import { useMeetingRoom } from './useMeetingRoom';
import { useRoomSettings } from './useRoomSettings';
export function useSharedMeetingRoom(
  conference: ReturnType<typeof useConference>,
  room: NativeRoom,
) {
  const { t } = useI18n();
  const model = useMeetingRoom(conference, room);
  const connected = model.connection === 'connected';
  const [shareError, setShareError] = useState('');
  const tiles: MeetingTile[] = model.allTracks.map((track) => ({
    id: model.key(track),
    name:
      model.directory?.participants?.[track.participant.identity]?.name ||
      track.participant.name ||
      '参与者',
    raiseHand: model.directory?.participants?.[track.participant.identity]?.raiseHand,
    owner: model.directory?.participants?.[track.participant.identity]?.owner,
    manager: model.directory?.participants?.[track.participant.identity]?.manager,
    avo: model.directory?.participants?.[track.participant.identity]?.avo,
    avatarColor:
      model.directory?.participants?.[track.participant.identity]?.hue !== undefined
        ? `hsl(${model.directory.participants[track.participant.identity].hue},52%,54%)`
        : undefined,
    screen: track.source === Track.Source.ScreenShare,
    speaking: track.participant.isSpeaking,
    local: track.participant.isLocal,
    microphone: track.participant.isMicrophoneEnabled,
    status: connected
      ? t(
          model.directory?.participants?.[track.participant.identity]?.status ||
            'settings.general.status.online',
        )
      : '重连中',
    statusColor: connected ? '#28C776' : '#E5A54B',
    video: isTrackReference(track) && !!track.publication.track && !track.publication.isMuted,
  }));
  const members: MeetingTile[] = model.directory?.participants
    ? Object.entries(model.directory.participants).map(([id, person]) => {
        const rtc = room.raw.getParticipantByIdentity(id);
        return {
          id,
          name: person.name,
          owner: person.owner,
          manager: person.manager,
          local: id === room.raw.localParticipant.identity,
          speaking: rtc?.isSpeaking,
          microphone: rtc?.isMicrophoneEnabled,
          video: rtc?.isCameraEnabled,
        };
      })
    : tiles.filter((tile) => !tile.screen);
  const canUse = (device: 'microphone' | 'camera' | 'screen') =>
    model.media.sources.includes(device) ||
    model.invitations.some((item) => item.device === device);
  const open = (
    panel: 'stage' | 'chat' | 'participants' | 'more' | 'settings' | 'channel' | 'apps' | 'share',
  ) => {
    if (panel === 'share') setShareError('');
    model.setPanel(panel);
  };
  const actions: MeetingAction[] = (['microphone', 'camera', 'screen'] as const).map((device) => ({
    id: device,
    icon: device,
    label: `${model.media[device] ? '关闭' : '开启'}${device === 'microphone' ? '麦克风' : device === 'camera' ? '摄像头' : '屏幕共享'}${canUse(device) ? '' : '（需要主持人邀请）'}`,
    active: model.media[device],
    muted: !model.media[device],
    disabled: !connected || !!model.media.busy || !canUse(device),
    onPress: () => {
      void model.toggle(device);
    },
  }));
  actions.push(
    { id: 'more', icon: 'more', label: '更多', onPress: () => open('more') },
    {
      id: 'leave',
      icon: 'leave',
      label: '退出会议',
      danger: true,
      onPress: () => {
        void conference.leave();
      },
    },
  );
  const settings = useRoomSettings(room, model, actions, conference.state.joined?.participantName);
  useEffect(() => {
    if (model.panel === 'stage') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (model.panel === 'settings' && settings.selected) settings.select(undefined);
      else model.setPanel(model.panel === 'settings' ? 'more' : 'stage');
      return true;
    });
    return () => subscription.remove();
  }, [model.panel, model.setPanel, settings.selected, settings.select]);
  const share = async () => {
    setShareError('');
    try {
      Clipboard.setString(conference.state.spaceName || room.raw.name);
      setShareError(t('phone_meeting.copied'));
    } catch {
      setShareError('未能打开系统分享，请重试。');
    }
  };
  const menu: MeetingAction[] = [
    {
      id: 'settings',
      icon: 'settings',
      label: settings.t('settings.title'),
      description: t('phone_meeting.settings_hint'),

      onPress: () => {
        settings.retry();
        settings.select(undefined);
        open('settings');
      },
    },
    {
      id: 'members',
      icon: 'members',
      label: t('phone_meeting.members'),
      description: `${model.participants.length} 人在会议中`,
      onPress: () => open('participants'),
    },
    {
      id: 'hand',
      icon: 'hand',
      label: t(model.raised ? 'more.app.raise.cancel' : 'phone_meeting.hand'),
      description: t('phone_meeting.hand_hint'),
      disabled: model.raising || conference.chat.state.connection !== 'connected',
      onPress: () => {
        open('stage');
        void model.raise();
      },
    },
    {
      id: 'share',
      icon: 'link',
      label: t('phone_meeting.share'),
      description: t('phone_meeting.share_hint'),
      onPress: () => {
        open('share');
      },
    },
    {
      id: 'apps',
      icon: 'app',
      label: t('more.app.title'),
      description: t('phone_meeting.apps_hint'),
      onPress: () => {
        settings.retry();
        settings.select('app');
        open('settings');
      },
    },
  ];
  return {
    ...model,
    t,
    members,
    connected,
    tiles,
    actions,
    menu,
    shareError,
    share,
    open,
    settings,
  };
}
