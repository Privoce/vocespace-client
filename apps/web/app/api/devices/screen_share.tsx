import {
  isTrackReference,
  ParticipantLoop,
  TrackLoop,
  useParticipants,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

export function ScreenTrack() {
  const tracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);

  const screen_track = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare)[0];
  const participants = useParticipants();
  return (
    <>
      {screen_track ? (
        <TrackLoop tracks={tracks}>
          <ParticipantLoop participants={participants}>
            <VideoTrack trackRef={screen_track}></VideoTrack>
          </ParticipantLoop>
        </TrackLoop>
      ) : (
        <div>
          <h1>Screen Share</h1>
        </div>
      )}
    </>
  );
}

