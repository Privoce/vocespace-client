import { AudioSession } from '@livekit/react-native';
import { Room, RoomEvent } from 'livekit-client';
import type { NativeJoin } from '@vocespace/contracts';
import type { ConferenceRoom } from './controller';

export class NativeRoom implements ConferenceRoom {
  readonly raw = new Room({ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true });
  private subscribed = false;
  private readonly onPublication = () => {
    if (!this.subscribed) return;
    for (const participant of this.raw.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values())
        publication.setSubscribed(true);
    }
  };
  constructor(private readonly onDisconnected: () => void) {
    this.raw.on(RoomEvent.Disconnected, onDisconnected);
    this.raw.on(RoomEvent.TrackPublished, this.onPublication);
  }
  async connect(details: NativeJoin) {
    await AudioSession.startAudioSession();
    await this.raw.connect(details.serverUrl, details.participantToken, { autoSubscribe: false });
  }
  subscribe() {
    this.subscribed = true;
    this.onPublication();
  }
  async disconnect() {
    this.subscribed = false;
    this.raw.off(RoomEvent.Disconnected, this.onDisconnected);
    this.raw.off(RoomEvent.TrackPublished, this.onPublication);
    try {
      await this.raw.disconnect();
    } finally {
      await AudioSession.stopAudioSession();
    }
  }
}
