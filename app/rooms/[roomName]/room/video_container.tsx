import styles from '@/styles/video_container.module.scss';
import {
  CarouselLayout,
  Chat,
  ConnectionStateToast,
  ControlBar,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  isTrackReference,
  LayoutContextProvider,
  ParticipantName,
  ParticipantTile,
  RoomName,
  TrackReferenceOrPlaceholder,
  useCreateLayoutContext,
  useMaybeRoomContext,
  usePinnedTracks,
  useTracks,
  VideoConferenceProps,
  WidgetState,
} from '@livekit/components-react';
import { AudioRenderer } from './audio_renderer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Participant, Room, RoomEvent, Track } from 'livekit-client';
import Search from 'antd/es/input/Search';
import { Collapse, CollapseProps } from 'antd';
import { Controls } from './controls';
import { Tools } from './tools/tools';
import { MainPanel } from './panel/main_panel';
import { FlexLayout } from './layout/flex';
import { RoomList } from './panel/room_list';
import { UserItem, UserList } from './panel/user_list';
import { ParticipantItem } from './panel/participant';
import { UserItemProp } from '@/lib/std';

/**
 * ## VideoContainer
 * @override livekit/components-react::VideoConference
 */
export function VideoContainer({
  chatMessageFormatter,
  SettingsComponent,
  ...props
}: VideoConferenceProps) {
  const is_web = typeof window !== 'undefined';
  const [widgetState, setWidgetState] = useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack = useRef<TrackReferenceOrPlaceholder | null>(null);
  const room = useMaybeRoomContext();
  // [tracks] -------------------------------------------------------------------
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );
  const widgetUpdate = (state: WidgetState) => {
    console.debug('updating widget state', state);
    setWidgetState(state);
  };

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  // console.error(focusTrack);
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

  useEffect(() => {
    // If screen share tracks are published, and no pin is set explicitly, auto set the screen share.
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      console.debug('Auto set screen share focus:', { newScreenShareTrack: screenShareTracks[0] });
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
      console.debug('Auto clearing screen share focus.');
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
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
  }, [
    screenShareTracks
      .map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
      .join(),
    focusTrack?.publication?.trackSid,
    tracks,
  ]);

  //   useWarnAboutMissingStyles();

  // [search room . member] -------------------------------------------------------------------
  const search_room = (room: string) => {
    console.log('search_room:', room);
  };

  const search_member = (member: string) => {
    console.log('search_member:', member);
  };

  // [room , member collapse] -------------------------------------------------------------------
  const rooms: CollapseProps['items'] = [
    {
      key: '1',
      label: 'My Chat Rooms',
      children: <RoomList data={[]}></RoomList>,
    },
    {
      key: '2',
      label: 'Public Rooms',
      children: <RoomList data={[]}></RoomList>,
    },
    {
      key: '3',
      label: 'My Conversations',
      children: <RoomList data={[]}></RoomList>,
    },
  ];
  const item_size = { height: '100px', width: '48%' };
  const tile_style = Object.assign(item_size, { backgroundColor: '#1E1E1E' });

  return (
    <div className={styles.container} {...props}>
      {is_web && (
        <LayoutContextProvider
          value={layoutContext}
          // onPinChange={handleFocusStateChange}
          onWidgetChange={widgetUpdate}
        >
          <div className={styles['container_left']}>
            <div className={styles['container_left_rooms']}>
              <Search
                style={{ margin: '8px' }}
                addonBefore="Room"
                placeholder="search room"
                allowClear
                onSearch={search_room}
              />
              <div className={styles.collapse_wrapper}>
                <Collapse bordered={false} items={rooms} defaultActiveKey={['1']} />
              </div>
            </div>
            <div className={styles['container_left_members']}>
              <header>
                <Search
                  addonBefore="Member"
                  placeholder="search member"
                  allowClear
                  onSearch={search_member}
                />
              </header>
              <main>{room && <UserList data={get_user_list(room)}></UserList>}</main>
              <footer>
                {room && (
                  <UserItem
                    item={{
                      name: room.localParticipant?.name || 'UnKnown',
                      status: 'processing',
                    }}
                  ></UserItem>
                )}
              </footer>
            </div>
          </div>
          <div className={styles['container_main']}>
            <header>
              <RoomName></RoomName>
              {/* <ControlBar controls={{ chat: true, settings: !!SettingsComponent }} /> */}
            </header>
            <main>
              <div className="lk-video-conference-inner" style={{ height: '100%' }}>
                {/* {!focusTrack ? (
                  <div className="lk-grid-layout-wrapper">
                    <GridLayout tracks={tracks}>
                      <ParticipantTile />
                    </GridLayout>
                  </div>
                ) : (
                  <div className="lk-focus-layout-wrapper">
                    <FocusLayoutContainer>
                      <CarouselLayout tracks={carouselTracks}>
                        <ParticipantTile />
                      </CarouselLayout>
                      {focusTrack && <FocusLayout trackRef={focusTrack} />}
                    </FocusLayoutContainer>
                  </div>
                )} */}
                {/* <GridLayout tracks={tracks}>
                  <ParticipantTile>
                    <UserPanel></UserPanel>
                  </ParticipantTile>
                </GridLayout> */}
                {room && <MainPanel room={room}></MainPanel>}
              </div>
            </main>
            <footer>
              <Controls></Controls>
            </footer>
          </div>
          <div className={styles['container_right']}>
            <div className={styles['container_right_participants']}>
              {/* <div className="lk-grid-layout-wrapper">
                <GridLayout tracks={tracks}>
                  <ParticipantTile style={{height: '120px'}} />
                </GridLayout>
                
              </div> */}
              <FlexLayout tracks={tracks} size={item_size}>
                {/* <ParticipantTile style={item_size} /> */}
                <ParticipantItem style={tile_style}></ParticipantItem>
              </FlexLayout>
            </div>
            <div className={styles['container_right_tools']}>
              <Tools></Tools>
            </div>
          </div>
          <Chat
            style={{ display: widgetState.showChat ? 'grid' : 'none' }}
            messageFormatter={chatMessageFormatter}
          />
          {SettingsComponent && (
            <div
              className="lk-settings-menu-modal"
              style={{ display: widgetState.showSettings ? 'block' : 'none' }}
            >
              <SettingsComponent />
            </div>
          )}
        </LayoutContextProvider>
      )}
      <AudioRenderer></AudioRenderer>
      <ConnectionStateToast></ConnectionStateToast>
    </div>
  );
}

export function isEqualTrackRef(
  a?: TrackReferenceOrPlaceholder,
  b?: TrackReferenceOrPlaceholder,
): boolean {
  if (a === undefined || b === undefined) {
    return false;
  }
  if (isTrackReference(a) && isTrackReference(b)) {
    return a.publication.trackSid === b.publication.trackSid;
  } else {
    return getTrackReferenceId(a) === getTrackReferenceId(b);
  }
}

/**
 * Returns a id to identify the `TrackReference` or `TrackReferencePlaceholder` based on
 * participant, track source and trackSid.
 * @remarks
 * The id pattern is: `${participantIdentity}_${trackSource}_${trackSid}` for `TrackReference`
 * and `${participantIdentity}_${trackSource}_placeholder` for `TrackReferencePlaceholder`.
 */
export function getTrackReferenceId(trackReference: TrackReferenceOrPlaceholder | number) {
  if (typeof trackReference === 'string' || typeof trackReference === 'number') {
    return `${trackReference}`;
  } else if (isTrackReferencePlaceholder(trackReference)) {
    return `${trackReference.participant.identity}_${trackReference.source}_placeholder`;
  } else if (isTrackReference(trackReference)) {
    return `${trackReference.participant.identity}_${trackReference.publication.source}_${trackReference.publication.trackSid}`;
  } else {
    throw new Error(`Can't generate a id for the given track reference: ${trackReference}`);
  }
}

export function isTrackReferencePlaceholder(
  trackReference?: TrackReferenceOrPlaceholder,
): trackReference is TrackReferencePlaceholder {
  if (!trackReference) {
    return false;
  }
  return (
    trackReference.hasOwnProperty('participant') &&
    trackReference.hasOwnProperty('source') &&
    typeof trackReference.publication === 'undefined'
  );
}

export type TrackReferencePlaceholder = {
  participant: Participant;
  publication?: never;
  source: Track.Source;
};

function get_user_list(room?: Room): UserItemProp[] {
  const user_list: UserItemProp[] = [];
  if (!room) {
    return user_list;
  }

  const participants = room.remoteParticipants;
  participants.forEach((value, key) => {
    user_list.push({
      name: value.name || key,
      status: 'success',
    });
  });

  const local_participant = room.localParticipant;
  user_list.push({
    name: local_participant.name || 'UnKnown',
    status: 'processing',
  });

  return user_list;
}
