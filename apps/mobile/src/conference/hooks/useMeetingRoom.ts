import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useConnectionState, useParticipants, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';
import Toast from '@ant-design/react-native/lib/toast';
import { useI18n } from '../../i18n';
import type { useConference } from './useConference';
import type { NativeRoom } from '../room';

export function useMeetingRoom(conference: ReturnType<typeof useConference>, room: NativeRoom) {
  const { t } = useI18n();
  const { onControl } = conference.chat;
  const directory = useSyncExternalStore(room.subscribeDirectory, room.getDirectory);
  const allowed = new Set(
    directory?.rooms.find((item) => item.name === directory.current)?.participantIds || [],
  );
  const participants = useParticipants().filter(
    (participant) => participant.isLocal || allowed.has(participant.identity),
  );
  const connection = useConnectionState();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  const media = useSyncExternalStore(room.media.subscribe, room.media.getSnapshot);
  const [panel, setPanel] = useState<
    'stage' | 'participants' | 'chat' | 'more' | 'settings' | 'channel' | 'apps' | 'share'
  >('stage');
  const [raising, setRaising] = useState(false);
  const raisePending = useRef(false);
  const raised = !!directory?.participants?.[room.raw.localParticipant.identity]?.raiseHand;
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const id = Toast.info(notice, 3, () => setNotice(''), false);
    return () => Toast.remove(id);
  }, [notice]);
  const [now, setNow] = useState(Date.now);
  const key = (track: (typeof tracks)[number]) => `${track.participant.identity}:${track.source}`;
  const activeTracks = tracks.filter(
    (track) =>
      (track.participant.isLocal || allowed.has(track.participant.identity)) &&
      (track.source !== Track.Source.ScreenShare || !track.publication?.isMuted),
  );
  useEffect(() => {
    if (!media.invitations.length) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [media.invitations]);
  useEffect(
    () =>
      onControl((event) => {
        if (event === 'raise_cancel') setNotice('主持人暂未同意上麦，请稍后再试。');
        if (event === 'invitation') setNotice('收到主持人的设备邀请，请点击下方按钮开启。');
        if (event === 'revoked') setNotice('主持人已关闭你的设备权限。');
      }),
    [onControl],
  );
  return {
    directory,
    participants,
    connection,
    media,
    panel,
    setPanel,
    channelTracks: tracks,
    allTracks: activeTracks,
    key,
    raising,
    raised,
    invitations: media.invitations.filter((item) => item.expiresAt > now),
    toggle: room.media.toggle,
    accept: room.media.accept,
    async raise() {
      if (raisePending.current) return;
      raisePending.current = true;
      setRaising(true);
      const next = !raised;
      try {
        const ok = await conference.chat.raise(next);
        if (!active.current) return;
        if (ok) {
          await room.syncDirectory();
          if (!active.current) return;
          const confirmed =
            room.getDirectory()?.participants?.[room.raw.localParticipant.identity]?.raiseHand;
          setNotice(
            t(
              confirmed === next
                ? next
                  ? 'phone_meeting.hand_raised'
                  : 'phone_meeting.hand_lowered'
                : 'phone_meeting.hand_failed',
            ),
          );
        } else setNotice(t('phone_meeting.hand_failed'));
      } catch {
        if (active.current) setNotice(t('phone_meeting.hand_failed'));
      } finally {
        raisePending.current = false;
        if (active.current) setRaising(false);
      }
    },
  };
}
