import { useEffect } from 'react';
import { ConnectionState, ParticipantTrackPermission, Track } from 'livekit-client';
import type { Room } from 'livekit-client';
import { WsBase } from '@/lib/std/device';
import { socket } from '@/app/[spaceName]/PageClientImpl';

interface SelfRoom {
  name: string;
  participants: string[];
  ownerId: string;
  isPrivate: boolean;
}

interface UseRoomSubscriptionOptions {
  space: Room | null | undefined;
  settings: any;
  selfRoom: SelfRoom | undefined;
  freshPermission: boolean;
  localTrackVersion: number;
  fetchSettings: () => Promise<void>;
}

export function useRoomSubscription({
  space,
  settings,
  selfRoom,
  freshPermission,
  localTrackVersion,
  fetchSettings,
}: UseRoomSubscriptionOptions) {
  useEffect(() => {
    if (!space || space.state !== ConnectionState.Connected || !selfRoom) return;

    const auth: ParticipantTrackPermission[] = [];
    const videoTrackSid = space.localParticipant.getTrackPublication(Track.Source.Camera)?.trackSid;
    const shareTrackSid = space.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.trackSid;
    const allowedTrackSids: string[] = [];
    if (videoTrackSid) allowedTrackSids.push(videoTrackSid);
    if (shareTrackSid) allowedTrackSids.push(shareTrackSid);
    const localScreenShareVolumes = settings.participants[space.localParticipant.identity]?.screenShareVolumes || {};

    space.remoteParticipants.forEach((rp) => {
      if (selfRoom.participants.includes(rp.identity)) {
        auth.push({ participantIdentity: rp.identity, allowAll: true });
        const volume = settings.participants[rp.identity]?.volume / 100.0 || 1.0;
        const volumeScreen = (localScreenShareVolumes[rp.identity] ?? 100.0) / 100.0;
        rp.setVolume(volume);
        rp.setVolume(volumeScreen, Track.Source.ScreenShareAudio);
      } else {
        auth.push({ participantIdentity: rp.identity, allowAll: false, allowedTrackSids });
      }
    });

    space.localParticipant.setTrackSubscriptionPermissions(false, auth);

    if (freshPermission) {
      fetchSettings().then(() => {
        socket.emit('update_user_status', { space: space.name } as WsBase);
      });
    }
  }, [space, settings, selfRoom, freshPermission, localTrackVersion, fetchSettings]);

  return null;
}
