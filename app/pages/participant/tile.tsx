import { isTrackReferencePlaceholder } from '@/app/devices/video_container';

import { loadVideo, useVideoBlur } from '@/lib/std/device';
import {
  AudioTrack,
  ConnectionQualityIndicator,
  isTrackReference,
  LockLockedIcon,
  ParticipantName,
  ParticipantPlaceholder,
  ParticipantTile,
  ParticipantTileProps,
  PinState,
  ScreenShareIcon,
  TrackMutedIndicator,
  TrackReference,
  TrackReferenceOrPlaceholder,
  useEnsureTrackRef,
  useFeatureContext,
  useIsEncrypted,
  useLocalParticipant,
  useMaybeLayoutContext,
  VideoTrack,
} from '@livekit/components-react';
import { LocalTrack, Track } from 'livekit-client';
import React, { useEffect } from 'react';
import VirtualRoleCanvas from '../virtual_role/live2d';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import { useRecoilState } from 'recoil';
import { deviceState } from '@/app/rooms/[roomName]/PageClientImpl';
import styles from '@/styles/controls.module.scss';
export interface ParticipantItemProps extends ParticipantTileProps {
  blurs: Record<string, { blur: number; screenBlur: number }>;
}

export const ParticipantItem: (
  props: ParticipantItemProps & React.RefAttributes<HTMLDivElement>,
) => React.ReactNode = React.forwardRef<HTMLDivElement, ParticipantItemProps>(
  function ParticipantItem({ trackRef, blurs }: ParticipantItemProps, ref) {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [device, setDevice] = useRecoilState(deviceState);
    const trackReference = useEnsureTrackRef(trackRef);
    const isEncrypted = useIsEncrypted(trackReference.participant);
    const layoutContext = useMaybeLayoutContext();
    const autoManageSubscription = useFeatureContext()?.autoSubscription;
    const { blurValue, setVideoBlur } = useVideoBlur({
      videoRef,
      initialBlur: 100.0,
    });
    const [loading, setLoading] = React.useState(true);
    useEffect(() => {
      if (blurs && Object.keys(blurs).length > 0) {
        if (trackReference.source === Track.Source.Camera) {
          setVideoBlur(blurs[trackReference.participant.identity]?.blur ?? 0.15);
        } else {
          setVideoBlur(blurs[trackReference.participant.identity]?.screenBlur ?? 0.15);
        }
        setLoading(false);
      }
    }, [blurs, trackReference.source]);

    const handleSubscribe = React.useCallback(
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
    

    const deviceTrack = React.useMemo(() => {
      if (isTrackReference(trackReference) && !loading) {
        if (trackReference.source === Track.Source.Camera) {
          return (
            <div style={{ height: '100%', width: '100%' }}>
              <VideoTrack
                ref={videoRef}
                style={{
                  filter: `blur(${blurValue}px)`,
                  visibility: device.virtualRole.enabled ? 'hidden' : 'visible',
                }}
                trackRef={trackReference}
                onSubscriptionStatusChanged={handleSubscribe}
                manageSubscription={autoManageSubscription}
              />
              {device.virtualRole.enabled && (
                <div className={styles.virtual_video_box_canvas}>
                  <VirtualRoleCanvas
                    video_ele={videoRef}
                    model_bg={device.virtualRole.bg}
                    model_role={device.virtualRole.role}
                    enabled={device.virtualRole.enabled}
                    trackRef={trackReference}
                  ></VirtualRoleCanvas>
                </div>
              )}
            </div>
          );
        } else if (trackReference.source === Track.Source.ScreenShare) {
          return (
            <VideoTrack
              ref={videoRef}
              style={{
                filter: `blur(${blurValue}px)`,
              }}
              trackRef={trackReference}
              onSubscriptionStatusChanged={handleSubscribe}
              manageSubscription={autoManageSubscription}
            />
          );
        } else {
          return (
            <AudioTrack trackRef={trackReference} onSubscriptionStatusChanged={handleSubscribe} />
          );
        }
      }
    }, [trackReference, loading, blurValue, videoRef, device.virtualRole]);

    return (
      <ParticipantTile ref={ref} trackRef={trackReference}>
        {deviceTrack}
        <div className="lk-participant-placeholder">
          <ParticipantPlaceholder />
        </div>
        <div className="lk-participant-metadata">
          <div className="lk-participant-metadata-item">
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
                <ParticipantName />
              </>
            ) : (
              <>
                <ScreenShareIcon style={{ marginRight: '0.25rem' }} />
                <ParticipantName>&apos;s screen</ParticipantName>
              </>
            )}
          </div>
          <ConnectionQualityIndicator className="lk-participant-metadata-item" />
        </div>
      </ParticipantTile>
    );
  },
);

export function isTrackReferencePinned(
  trackReference: TrackReferenceOrPlaceholder,
  pinState: PinState | undefined,
): boolean {
  if (typeof pinState === 'undefined') {
    return false;
  }
  if (isTrackReference(trackReference)) {
    return pinState.some(
      (pinnedTrackReference) =>
        pinnedTrackReference.participant.identity === trackReference.participant.identity &&
        isTrackReference(pinnedTrackReference) &&
        pinnedTrackReference.publication.trackSid === trackReference.publication.trackSid,
    );
  } else if (isTrackReferencePlaceholder(trackReference)) {
    return pinState.some(
      (pinnedTrackReference) =>
        pinnedTrackReference.participant.identity === trackReference.participant.identity &&
        isTrackReferencePlaceholder(pinnedTrackReference) &&
        pinnedTrackReference.source === trackReference.source,
    );
  } else {
    return false;
  }
}

