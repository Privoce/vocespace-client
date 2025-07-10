import {
  AudioTrack,
  ConnectionQualityIndicator,
  isTrackReference,
  LockLockedIcon,
  ParticipantName,
  ParticipantPlaceholder,
  ParticipantTile,
  ParticipantTileProps,
  ScreenShareIcon,
  TrackMutedIndicator,
  useEnsureTrackRef,
  useFeatureContext,
  useIsEncrypted,
  useLocalParticipant,
  useMaybeLayoutContext,
  useTrackMutedIndicator,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import { isTrackReferencePinned } from './tile';
import { ParticipantSettings, RoomSettings } from '@/lib/std/room';
import { useVideoBlur, WsTo } from '@/lib/std/device';
import { SvgResource } from '@/app/resources/svg';
import { useRecoilState } from 'recoil';
import { roomStatusState, userState, virtualMaskState } from '@/app/[roomName]/PageClientImpl';
import { UserStatus } from '@/lib/std';
import { WaveHand, WavePin } from '../controls/wave';

export interface ParticipantTileMiniProps extends ParticipantTileProps {
  settings: RoomSettings;
  /**
   * host room name
   */
  room: string;
}

export const ParticipantTileMini = forwardRef<HTMLDivElement, ParticipantTileMiniProps>(
  ({ trackRef, settings, room }: ParticipantTileMiniProps, ref) => {
    const trackReference = useEnsureTrackRef(trackRef);
    const { localParticipant } = useLocalParticipant();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [uState, setUState] = useRecoilState(userState);
    const [uRoomStatusState, setURoomStatusState] = useRecoilState(roomStatusState);
    const layoutContext = useMaybeLayoutContext();
    const autoManageSubscription = useFeatureContext()?.autoSubscription;
    const isEncrypted = useIsEncrypted(trackReference.participant);
    const [virtualMask, setVirtualMask] = useRecoilState(virtualMaskState);

    const { blurValue, setVideoBlur } = useVideoBlur({
      videoRef,
      initialBlur: 0.0,
    });

    useEffect(() => {
      if (settings.participants && Object.keys(settings.participants).length > 0) {
        if (trackReference.source === Track.Source.Camera) {
          setVideoBlur(settings.participants[trackReference.participant.identity]?.blur ?? 0.0);
        } else {
          setVideoBlur(
            settings.participants[trackReference.participant.identity]?.screenBlur ?? 0.0,
          );
        }
        // setLoading(false);
      }
    }, [settings.participants, trackReference]);

    const wsTo = useMemo(() => {
      return {
        room,
        senderName: localParticipant.name,
        senderId: localParticipant.identity,
        receiverId: trackReference.participant.identity,
        socketId: settings.participants[trackReference.participant.identity]?.socketId,
      } as WsTo;
    }, [room, localParticipant, trackReference, settings.participants]);

    const defineStatus = useMemo(() => {
      return uRoomStatusState.find(
        (item) => item.id === settings.participants[trackReference.participant.identity]?.status,
      );
    }, [uRoomStatusState, settings.participants, trackReference]);
    const videoFilter = useMemo(() => {
      return settings.participants[trackReference.participant.identity]?.virtual?.enabled ?? false
        ? `none`
        : `blur(${blurValue}px)`;
    }, [settings.participants, trackReference.participant.identity, blurValue]);

    const handleSubscribe = useCallback(
      (subscribed: boolean) => {
        if (
          trackReference.source &&
          !subscribed &&
          layoutContext &&
          layoutContext.pin.dispatch &&
          isTrackReferencePinned(trackReference, layoutContext.pin.state)
        ) {
          layoutContext.pin.dispatch({ msg: 'clear_pin' });
        }
      },
      [trackReference, layoutContext],
    );

    const userStatusDisply = useMemo(() => {
      switch (settings.participants[trackReference.participant.identity]?.status) {
        case UserStatus.Online:
          return 'online_dot';
        case UserStatus.Offline:
          return 'offline_dot';
        case UserStatus.Busy:
          return 'busy_dot';
        case UserStatus.Leisure:
          return 'leisure_dot';
        default:
          return 'online_dot';
      }
    }, [settings.participants, trackReference.participant.identity]);

    return (
      <ParticipantTile ref={ref} trackRef={trackReference}>
        {isTrackReference(trackReference) &&
        (trackReference.source === Track.Source.Camera ||
          trackReference.source === Track.Source.ScreenShare) ? (
          <VideoTrack
            ref={videoRef}
            style={{
              WebkitFilter: videoFilter,
              filter: videoFilter,
              transition: 'filter 0.2s ease-in-out',
              zIndex: '11',
            }}
            trackRef={trackReference}
            onSubscriptionStatusChanged={handleSubscribe}
            manageSubscription={autoManageSubscription}
          />
        ) : (
          isTrackReference(trackReference) && (
            <AudioTrack trackRef={trackReference} onSubscriptionStatusChanged={handleSubscribe} />
          )
        )}
        <div
          className="lk-participant-placeholder"
          style={{ border: '1px solid #111', zIndex: 110 }}
        >
          <ParticipantPlaceholder />
        </div>
        <div className="lk-participant-metadata" style={{ zIndex: 1000 }}>
          <div
            className="lk-participant-metadata-item"
            style={{ maxWidth: 'calc(100% - 32px)', width: 'max-content' }}
          >
            {trackReference.source === Track.Source.Camera ? (
              <>
                {isEncrypted && <LockLockedIcon style={{ marginRight: '0.25rem' }} />}
                <TrackMutedIndicator
                  trackRef={{
                    participant: trackReference.participant,
                    source: Track.Source.Microphone,
                  }}
                  show={'muted'}
                ></TrackMutedIndicator>
                <ParticipantName
                  style={{
                    maxWidth: `calc(100% - ${
                      useTrackMutedIndicator({
                        participant: trackReference.participant,
                        source: Track.Source.Microphone,
                      }).isMuted
                        ? 2.5
                        : 1.25
                    }rem)`,
                    overflow: 'clip',
                    textWrap: 'nowrap',
                    width: '100%',
                  }}
                />
                <div
                  style={{ marginLeft: '0.25rem', display: 'inline-flex', alignItems: 'center' }}
                >
                  {defineStatus ? (
                    <SvgResource
                      type="dot"
                      svgSize={16}
                      color={defineStatus.icon.color}
                    ></SvgResource>
                  ) : (
                    <SvgResource type={userStatusDisply} svgSize={16}></SvgResource>
                  )}
                </div>
              </>
            ) : (
              <>
                <ScreenShareIcon style={{ marginRight: '0.25rem' }} />
                <ParticipantName
                  style={{
                    maxWidth: 'calc(100% - 1.5rem)',
                    overflow: 'clip',
                    textWrap: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  &apos;s screen
                </ParticipantName>
              </>
            )}
          </div>

          <ConnectionQualityIndicator className="lk-participant-metadata-item" />
        </div>
        {trackReference.participant.identity != localParticipant.identity && (
          <WaveHand
            wsTo={wsTo}
            contextUndefined={false}
            style={{
              zIndex: 111,
              left: '0.25rem',
              top: '0.25rem',
              width: 'fit-content',
            }}
          />
        )}
      </ParticipantTile>
    );
  },
);
