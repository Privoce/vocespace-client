import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useConnectionState, useParticipants, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';
import type { useConference } from './useConference';
import type { NativeRoom } from './room';

const TRACKS_PER_PAGE = 4;

export function useMeetingRoom(conference: ReturnType<typeof useConference>, room: NativeRoom) {
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
  const [pinned, setPinned] = useState<string | null>();
  const [trackPage, setTrackPage] = useState(0);
  const [raising, setRaising] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now);
  const key = (track: (typeof tracks)[number]) => `${track.participant.identity}:${track.source}`;
  const activeTracks = tracks.filter(
    (track) =>
      (track.participant.isLocal || allowed.has(track.participant.identity)) &&
      (track.source !== Track.Source.ScreenShare || !track.publication?.isMuted),
  );
  const trackPageCount = Math.max(1, Math.ceil(activeTracks.length / TRACKS_PER_PAGE));
  useEffect(() => {
    setTrackPage((page) => Math.min(page, trackPageCount - 1));
  }, [trackPageCount]);
  const focus =
    pinned === null
      ? undefined
      : activeTracks.find((track) => key(track) === pinned) ||
        activeTracks.find((track) => track.source === Track.Source.ScreenShare);
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
    allTracks: activeTracks,
    tracks: activeTracks.slice(trackPage * TRACKS_PER_PAGE, (trackPage + 1) * TRACKS_PER_PAGE),
    trackPage,
    trackPageCount,
    setTrackPage,
    focus,
    key,
    pin: (id: string) => setPinned(focus && key(focus) === id ? null : id),
    raising,
    notice,
    invitations: media.invitations.filter((item) => item.expiresAt > now),
    toggle: room.media.toggle,
    accept: room.media.accept,
    async raise() {
      if (raising) return;
      setRaising(true);
      const ok = await conference.chat.raise();
      if (!active.current) return;
      setRaising(false);
      setNotice(
        ok
          ? '已向主持人举手。收到邀请后，点击开启麦克风。'
          : '举手未发送成功，请检查会议连接后重试。',
      );
    },
  };
}
