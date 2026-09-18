'use client';

import { useUserStatus } from '@/app/pages/controls/hooks/index';
import { useReplaceLivekitTrack } from '@/app/pages/layout/unified';
import { getTrackReferenceIdSafe, TrackReferenceOrPlaceholder, VideoLayoutEntity } from '@/features/conference/shared';
import { socket } from '@/lib/realtime/socket';
import {
  WsBase
} from '@/lib/std/device';
import { useSpaceStore } from '@/lib/store';
import {
  isTrackReference,
  usePinnedTracks,
  useTracks,
  WidgetState
} from '@livekit/components-react';
import {
  RoomEvent,
  Track
} from 'livekit-client';
import React, {
  useMemo
} from 'react';
import type { useConferenceMembership } from './useConferenceMembership';

export function useConferenceMedia(context: ReturnType<typeof useConferenceMembership>) {
  const {
    layoutContext,
    messageApi,
    space,
    init,
    setInit,
    t,
    setIsFocus,
    collapsed,
    deviceType,
    controlsRef,
    cacheWidgetState,
    setCacheWidgetState,
    setChatOpen,
    settings,
    updateSettings,
    fetchSettings,
    showSideChannel,
    isActive,
    selfRoom,
  } = context;
  const [widgetState, setWidgetState] = React.useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);
  const originTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );
  const tracks = useMemo(() => {
    if (!selfRoom) return originTracks;
    // 过滤参与者轨道，只身下selfRoom中的参与者的轨道
    const roomTracks = originTracks.filter((track) =>
      selfRoom.participants.includes(track.participant.identity),
    );

    // roomTracks.push(FakeParticipantTrack(selfRoom.name)); // todo

    return roomTracks;
  }, [originTracks, selfRoom]);
  const widgetUpdate = (state: WidgetState) => {
    if (cacheWidgetState && cacheWidgetState == state) {
      return;
    } else {
      setCacheWidgetState(state);
      setWidgetState(state);
    }
  };

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);
  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const focusedTilePlayerId = useMemo(() => {
    if (!space?.name || !focusTrack || focusTrack.source !== Track.Source.Unknown) return null;

    const participantName = focusTrack.participant.name || focusTrack.participant.identity;
    const prefix = `${space.name}_player_`;
    return participantName.startsWith(prefix) ? participantName.slice(prefix.length) : null;
  }, [focusTrack, space?.name]);
  const isTilePlayerFocused = !!focusedTilePlayerId;
  React.useEffect(() => {
    // If screen share tracks are published, and no pin is set explicitly, auto set the screen share.
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      setIsFocus(true);
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      setIsFocus(false);
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (tr) =>
          tr.participant.identity === focusTrack.participant.identity &&
          tr.source === focusTrack.source,
      );
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack });
      }
    }
  }, [screenShareTracks, focusTrack, tracks, layoutContext.pin, lastAutoFocusedScreenShareTrack, setIsFocus]);
  const toRenameSetting = (isDefineStatus?: boolean) => {
    controlsRef.current?.openSettings('profile', isDefineStatus);
  };
  const toSettingGeneral = () => {
    controlsRef.current?.openSettings('general');
  };
  const handleUpdateRoom = async () => {
    await fetchSettings();
    // 需要更新用户视图Layout，因为发现在focus layout下切换房间会导致视图没有更新，依然看到上一个房间的视图
    if (focusTrack) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      setIsFocus(false);
    }

    // 通知其他参与者更新用户状态
    if (space) {
      socket.emit('update_user_status', {
        space: space.name,
      } as WsBase);
    }
  };
  const { setUserStatus } = useUserStatus(space, updateSettings);
  const clearRoom = async () => {
    // 退出是设置init为true
    setInit(true);
  };
  const showFlot = useMemo(() => {
    return deviceType === 'desktop' ? true : collapsed;
  }, [collapsed, deviceType]);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      setChatOpen(true);
    }
  };
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setChatOpen(true);
  };
  const mainViewWidth = useMemo(() => {
    return !showSideChannel
      ? '100vw'
      : collapsed
        ? isActive
          ? 'calc(100vw - 28px)'
          : '100vw'
        : 'calc(100vw - 280px)';
  }, [collapsed, showSideChannel, isActive]);
  const { entities: trackEntities, focusEntity: focusedTrackEntity } = useReplaceLivekitTrack<
    TrackReferenceOrPlaceholder,
    VideoLayoutEntity
  >({
    tracks,
    focusTrack: focusTrack ?? null,
    getTrackId: (track) => getTrackReferenceIdSafe(track),
    mapTrackToEntity: (track, id) => ({
      id,
      category: 'track',
      type: 'participant',
      source: `${track.source ?? track.publication?.source ?? Track.Source.Unknown}`,
      label: track.participant?.identity,
      payload: track,
    }),
    appendFocusTrack: !isTilePlayerFocused,
  });
  const onlineCount = Object.values(settings.participants).filter(participant => participant.online).length;
  const toggleChannel = () => useSpaceStore.getState().setCollapsed(!useSpaceStore.getState().collapsed);
  const copyRoomName = async () => {
    if (!space) return;
    try { await navigator.clipboard.writeText(space.name); messageApi.success(t('recording.copy.success')); }
    catch { messageApi.error(t('recording.copy.error')); }
  };
  return {
    ...context,
    widgetState,
    setWidgetState,
    lastAutoFocusedScreenShareTrack,
    originTracks,
    tracks,
    widgetUpdate,
    screenShareTracks,
    focusTrack,
    focusedTilePlayerId,
    isTilePlayerFocused,
    toRenameSetting,
    toSettingGeneral,
    handleUpdateRoom,
    setUserStatus,
    clearRoom,
    showFlot,
    handleDragOver,
    handleDrop,
    handleDrag,
    mainViewWidth,
    trackEntities,
    focusedTrackEntity,
    onlineCount,
    toggleChannel,
    copyRoomName,
  };
}
