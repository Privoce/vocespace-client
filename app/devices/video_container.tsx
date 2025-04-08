import { is_web } from '@/lib/std';
import {
  CarouselLayout,
  Chat,
  ConnectionStateToast,
  ControlBar,
  FocusLayoutContainer,
  GridLayout,
  isTrackReference,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  TrackReference,
  useCreateLayoutContext,
  useMaybeRoomContext,
  usePinnedTracks,
  useTracks,
  VideoConferenceProps,
  WidgetState,
} from '@livekit/components-react';
import {
  ConnectionState,
  Participant,
  Room,
  RoomEvent,
  RpcInvocationData,
  Track,
} from 'livekit-client';
import React, { useEffect, useState } from 'react';
import { ControlBarExport, Controls } from './controls/bar';
import { useRecoilState } from 'recoil';
import { userState } from '../rooms/[roomName]/PageClientImpl';
import { ParticipantItem } from '../pages/participant/tile';
import { useRoomSettings } from '@/lib/hooks/room_settings';
import { MessageInstance } from 'antd/es/message/interface';
import { NotificationInstance } from 'antd/es/notification/interface';
import { useI18n } from '@/lib/i18n/i18n';

export function VideoContainer({
  chatMessageFormatter,
  chatMessageDecoder,
  chatMessageEncoder,
  SettingsComponent,
  noteApi,
  messageApi,
  ...props
}: VideoConferenceProps & { messageApi: MessageInstance; noteApi: NotificationInstance }) {
  const room = useMaybeRoomContext();
  const { t } = useI18n();
  const [device, setDevice] = useRecoilState(userState);
  const controlsRef = React.useRef<ControlBarExport>(null);
  const waveAudioRef = React.useRef<HTMLAudioElement>(null);
  const [cacheWidgetState, setCacheWidgetState] = useState<WidgetState>();
  const { settings, updateSettings, fetchSettings, setSettings } = useRoomSettings(
    room?.name || '', // 房间 ID
    room?.localParticipant?.identity || '', // 参与者 ID
  );
  useEffect(() => {
    if (!room || room.state !== ConnectionState.Connected) return;

    const syncSettings = async () => {
      // 将当前参与者的摄像头模糊度发送到服务器
      await updateSettings({
        blur: device.blur,
      });

      const newSettings = await fetchSettings();
      setSettings(newSettings);
    };

    room.registerRpcMethod('wave', async (data: RpcInvocationData) => {
      if (waveAudioRef.current) {
        waveAudioRef.current.play();
        const payload = JSON.parse(data.payload) as { name: string };

        noteApi.info({
          message: `${payload.name} ${t('common.wave_msg')}`,
        });
      }
      return JSON.stringify(true);
    });
    syncSettings();
  }, [room?.state]);

  const [widgetState, setWidgetState] = React.useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  const widgetUpdate = (state: WidgetState) => {
    if (cacheWidgetState && cacheWidgetState == state) {
      return;
    } else {
      console.debug('updating widget state', state);
      setCacheWidgetState(state);
      setWidgetState(state);
    }
  };

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

  React.useEffect(() => {
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
  const audioVolume = React.useMemo(() => {
    return device.volume / 100.0;
  }, [device.volume]);

  const toSettingGeneral = () => {
    controlsRef.current?.openSettings('general');
  };

  return (
    <div className="lk-video-conference" {...props}>
      {is_web() && (
        <LayoutContextProvider
          value={layoutContext}
          // onPinChange={handleFocusStateChange}
          onWidgetChange={widgetUpdate}
        >
          <div className="lk-video-conference-inner">
            {!focusTrack ? (
              <div className="lk-grid-layout-wrapper">
                <GridLayout tracks={tracks}>
                  <ParticipantItem
                    blurs={settings}
                    toSettings={toSettingGeneral}
                    messageApi={messageApi}
                  ></ParticipantItem>
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper">
                <FocusLayoutContainer>
                  <CarouselLayout tracks={carouselTracks}>
                    <ParticipantItem blurs={settings} messageApi={messageApi}></ParticipantItem>
                  </CarouselLayout>
                  {focusTrack && (
                    <ParticipantItem
                      blurs={settings}
                      trackRef={focusTrack}
                      messageApi={messageApi}
                    ></ParticipantItem>
                  )}
                </FocusLayoutContainer>
              </div>
            )}
            <Controls
              ref={controlsRef}
              controls={{ chat: true, settings: !!SettingsComponent }}
              updateSettings={updateSettings}
            ></Controls>
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
      <RoomAudioRenderer volume={audioVolume} />
      <ConnectionStateToast />
      <audio
        ref={waveAudioRef}
        style={{ display: 'none' }}
        src={`${process.env.NEXT_PUBLIC_BASE_PATH}/audios/vocespacewave.m4a`}
      ></audio>
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

export type TrackReferenceOrPlaceholder = TrackReference | TrackReferencePlaceholder;

export type TrackReferencePlaceholder = {
  participant: Participant;
  publication?: never;
  source: Track.Source;
};
