'use client';
import { useState } from 'react';
import { isTrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useChat } from '@/components/Chat/hooks/useChat';
import type { ConferenceModel } from './mediaStage';
export function useSharedMeeting(model: ConferenceModel) {
  const [membersOpen, setMembersOpen] = useState(false);
  const chat = useChat(
    {
      space: model.space!,
      spaceInfo: model.settings,
      sendFileConfirm: model.sendFileConfirm,
      messageApi: model.messageApi,
      onClose: () => model.setChatOpen(false),
    },
    null,
  );
  const tracks = model.tracks.filter(
    (track) => track.source !== Track.Source.ScreenShare || !track.publication?.isMuted,
  );
  const key = (track: (typeof tracks)[number]) => `${track.participant.identity}:${track.source}`;
  const { t } = model;
  const tiles = tracks.map((track) => ({
    id: key(track),
    name: track.participant.name || track.participant.identity,
    local: track.participant.isLocal,
    owner: model.settings.ownerId === track.participant.identity,
    manager: model.settings.managers.includes(track.participant.identity),
    microphone: track.participant.isMicrophoneEnabled,
    role:
      model.settings.ownerId === track.participant.identity
        ? '👑'
        : model.settings.managers.includes(track.participant.identity)
          ? t('more.participant.manager')
          : undefined,
    status: model.settings.participants[track.participant.identity]?.status
      ? t(model.settings.participants[track.participant.identity].status)
      : t('settings.general.status.online'),
    screen: track.source === Track.Source.ScreenShare,
    speaking: track.participant.isSpeaking,
    video: isTrackReference(track) && !!track.publication.track && !track.publication.isMuted,
  }));
  return { membersOpen, setMembersOpen, chat, tracks, key, t, tiles };
}
