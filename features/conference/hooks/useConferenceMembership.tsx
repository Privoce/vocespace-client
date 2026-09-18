'use client';

import { useRoomSubscription } from '@/app/pages/controls/hooks/index';
import { TilePlayerItem } from '@/app/pages/participant/player';
import { api } from '@/lib/api';
import { useLatestCallback } from '@/lib/hooks/use-latest-callback';
import { socket } from '@/lib/realtime/socket';
import {
  WsTilePlayer
} from '@/lib/std/device';
import { PARTICIPANT_SETTINGS_KEY } from '@/lib/std/space';
import { useUserStore } from '@/lib/store';
import {
  ConnectionState,
  ParticipantEvent
} from 'livekit-client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo, useRef, useState
} from 'react';
import type { useConferenceEvents } from './useConferenceEvents';

export function useConferenceMembership(context: ReturnType<typeof useConferenceEvents>) {
  const { space, uState, freshPermission, localTrackVersion, setLocalTrackVersion, settings, fetchSettings } = context;
  const connectionState = space?.state;
  const selfRoom = useMemo(() => {
    if (!space || connectionState !== ConnectionState.Connected || !settings || !settings.children)
      return;

    let selfRoom = settings.children.find((child) => {
      return child.participants.includes(space.localParticipant.identity);
    });

    let allChildParticipants = settings.children.reduce((acc, room) => {
      return acc.concat(room.participants);
    }, [] as string[]);

    if (!selfRoom) {
      // 这里还需要过滤掉进入子房间的参与者
      selfRoom = {
        name: space.name,
        participants: Object.keys(settings.participants).filter((pid) => {
          return !allChildParticipants.includes(pid);
        }),
        ownerId: settings.ownerId,
        isPrivate: false,
      };
    }
    return selfRoom;
  }, [settings, space, connectionState]);
  const [tilePlayerItems, setTilePlayerItems] = useState<TilePlayerItem[]>([]);
  const requestVersion = useRef(0);
  const spaceName = space?.name;
  const roomName = selfRoom?.name;
  const identity = space?.localParticipant.identity;
  const refreshSettings = useLatestCallback(fetchSettings);
  const fetchTilePlayers = useCallback(async () => {
    const request = ++requestVersion.current;
    if (!spaceName || !roomName || !identity) return;
    try {
      const response = await api.handleTilePlayerFile(spaceName, roomName, 'ls', undefined, undefined, identity);
      if (response.ok) {
        const data = await response.json();
        if (request === requestVersion.current) setTilePlayerItems(Array.isArray(data.players) ? data.players : []);
      }
    } catch (error) { console.error('fetchTilePlayers error', error); }
  }, [spaceName, roomName, identity]);
  useEffect(() => {
    setTilePlayerItems([]);
    void fetchTilePlayers();
    const version = requestVersion;
    return () => { version.current++; };
  }, [fetchTilePlayers]);
  useEffect(() => {
    const onChange = (message: WsTilePlayer) => {
      if (message.participantId !== identity && message.space === spaceName) {
        void fetchTilePlayers(); void refreshSettings();
      }
    };
    socket.on('tile_player_change_response', onChange);
    return () => { socket.off('tile_player_change_response', onChange); };
  }, [spaceName, identity, fetchTilePlayers, refreshSettings]);
  useLayoutEffect(() => {
    if (space?.state === ConnectionState.Connected && freshPermission) void refreshSettings();
  }, [space, space?.state, freshPermission, refreshSettings]);
  useRoomSubscription({
    space,
    settings,
    selfRoom,
    freshPermission,
    localTrackVersion,
    fetchSettings,
  });
  useEffect(() => {
    if (!space) return;
    const onLocalTrackChange = () => {
      setLocalTrackVersion((v) => v + 1);
    };
    space.localParticipant.on(ParticipantEvent.LocalTrackPublished, onLocalTrackChange);
    space.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, onLocalTrackChange);
    return () => {
      space.localParticipant.off(ParticipantEvent.LocalTrackPublished, onLocalTrackChange);
      space.localParticipant.off(ParticipantEvent.LocalTrackUnpublished, onLocalTrackChange);
    };
  }, [space, setLocalTrackVersion]);
  useEffect(() => {
    if (!space || connectionState !== ConnectionState.Connected || !settings) return;
    // 同步settings中当前参与者的数据到uState中 -----------------------------------------------------
    if (settings.participants[space.localParticipant.identity]) {
      useUserStore.setState((prev) => {
        let newState = {
          ...prev,
          ...settings.participants[space.localParticipant.identity],
        };
        // 同步后还需要设置到localStorage中
        localStorage.setItem(PARTICIPANT_SETTINGS_KEY, JSON.stringify(newState));
        return newState;
      });
    }
  }, [space, settings, connectionState]);
  return { ...context, selfRoom, tilePlayerItems, setTilePlayerItems, fetchTilePlayers };
}
