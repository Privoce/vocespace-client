import { ApiError } from '@vocespace/client-sdk';
import type {
  NativeSettingsPatch,
  NativeSettingsSnapshot,
  NativeRoomDirectory,
} from '@vocespace/contracts';
import { AudioSession } from '@livekit/react-native';
import { ParticipantEvent, Room, RoomEvent, Track } from 'livekit-client';
import type { createNativeApi } from '../api/session';
import { createMediaController } from './media-controller';
import type { NativeDevice, NativeJoin } from '@vocespace/contracts';
import type { ConferenceRoom } from './controller';

export class NativeRoom implements ConferenceRoom {
  readonly raw = new Room({ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true });
  private subscribed = false;
  private directory?: NativeRoomDirectory;
  private directoryTimer?: ReturnType<typeof setInterval>;
  private directoryFlight?: Promise<void>;
  private directoryListeners = new Set<() => void>();
  getDirectory = () => this.directory;
  subscribeDirectory = (listener: () => void) => {
    this.directoryListeners.add(listener);
    return () => {
      this.directoryListeners.delete(listener);
    };
  };
  private refreshDirectory = () => {
    if (this.directoryFlight) return this.directoryFlight;
    this.directoryFlight = (async () => {
      const directory = await this.api.sdk.native.rooms(
        this.details!.joinId,
        this.captureAbort.signal,
      );
      if (this.captureAbort.signal.aborted) return;
      this.directory = directory;
      this.directoryListeners.forEach((listener) => listener());
      this.onPublication();
    })().finally(() => {
      this.directoryFlight = undefined;
    });
    return this.directoryFlight;
  };
  private details?: NativeJoin;
  private readonly captureAbort = new AbortController();
  private permits(device: NativeDevice) {
    const permissions = this.raw.localParticipant.permissions;
    return (
      !!permissions?.canPublish &&
      permissions.canPublishSources.includes(
        Track.sourceToProto(
          device === 'screen'
            ? Track.Source.ScreenShare
            : device === 'camera'
              ? Track.Source.Camera
              : Track.Source.Microphone,
        ),
      )
    );
  }
  private waitForPermission(device: NativeDevice) {
    if (this.captureAbort.signal.aborted) return Promise.reject(new Error('ROOM_CLOSED'));
    if (this.permits(device)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const done = (error?: Error) => {
        clearTimeout(timer);
        this.raw.localParticipant.off(ParticipantEvent.ParticipantPermissionsChanged, changed);
        this.captureAbort.signal.removeEventListener('abort', cancelled);
        if (error) reject(error);
        else resolve();
      };
      const changed = () => {
        if (this.permits(device)) done();
      };
      const cancelled = () => done(new Error('ROOM_CLOSED'));
      const timer = setTimeout(() => done(new Error('MEDIA_PERMISSION_TIMEOUT')), 8000);
      this.raw.localParticipant.on(ParticipantEvent.ParticipantPermissionsChanged, changed);
      this.captureAbort.signal.addEventListener('abort', cancelled, { once: true });
    });
  }
  private readonly permissionsChanged = () => {
    for (const device of ['microphone', 'camera', 'screen'] as const) {
      if (
        !this.permits(device) &&
        (this.media.getSnapshot()[device] || this.media.getSnapshot().busy === device)
      )
        void this.media.revoke(device);
    }
    if (this.subscribed) void this.media.refresh();
  };
  readonly media;
  showScreenPicker?: () => Promise<void>;
  private readonly syncMedia = () => this.media.sync();
  private readonly previewPermissions = () => {
    if (!this.details) return;
    const main = !this.details.childRoom;
    if (main) this.raw.localParticipant.setTrackSubscriptionPermissions(true);
    else
      this.raw.localParticipant.setTrackSubscriptionPermissions(false, [
        ...Array.from(this.raw.remoteParticipants.values())
          .filter((participant) => participant.identity !== 'preview_main')
          .map((participant) => ({ participantIdentity: participant.identity, allowAll: true })),
        { participantIdentity: 'preview_main', allowAll: false, allowedTrackSids: [] },
      ]);
  };
  private readonly applyVolume = () => {
    const volume = (this.settingsSnapshot?.volume ?? 100) / 100;
    for (const participant of this.raw.remoteParticipants.values())
      for (const publication of participant.audioTrackPublications.values()) {
        const track = publication.track?.mediaStreamTrack as unknown as
          | { _setVolume?: (value: number) => void }
          | undefined;
        track?._setVolume?.(volume);
      }
  };
  private readonly onPublication = () => {
    if (!this.subscribed) return;
    const ids =
      this.directory?.rooms.find((room) => room.name === this.directory?.current)?.participantIds ||
      [];
    for (const participant of this.raw.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values())
        publication.setSubscribed(ids.includes(participant.identity));
    }
  };
  records(signal?: AbortSignal) {
    return this.api.sdk.native.records(this.details!.joinId, signal);
  }
  downloadRecording(key: string, signal?: AbortSignal) {
    return this.api.sdk.native.downloadRecording(this.details!.joinId, key, signal);
  }
  deleteRecording(key: string, signal?: AbortSignal) {
    return this.api.sdk.native.deleteRecording(this.details!.joinId, key, signal);
  }
  isOwner = false;
  private settingsSnapshot?: NativeSettingsSnapshot;
  private settingsRevision = 0;
  async settings(signal?: AbortSignal) {
    if (!this.details) return Promise.reject(new Error('ROOM_CLOSED'));
    const revision = this.settingsRevision;
    const snapshot = await this.api.sdk.native.settings(this.details.joinId, signal);
    if (signal?.aborted || this.captureAbort.signal.aborted) throw new Error('ROOM_CLOSED');
    if (revision !== this.settingsRevision && this.settingsSnapshot) return this.settingsSnapshot;
    this.isOwner = !!snapshot.room?.isOwner;
    this.settingsSnapshot = snapshot;
    this.applyVolume();
    return snapshot;
  }
  async updateSettings(patch: NativeSettingsPatch, signal?: AbortSignal) {
    if (!this.details) throw new Error('ROOM_CLOSED');
    this.settingsRevision++;
    const snapshot = await this.api.sdk.native.updateSettings(this.details.joinId, patch, signal);
    if (signal?.aborted || this.captureAbort.signal.aborted) throw new Error('ROOM_CLOSED');
    this.isOwner = !!snapshot.room?.isOwner;
    this.settingsSnapshot = snapshot;
    if (patch.volume !== undefined) {
      await AudioSession.setDefaultRemoteAudioTrackVolume(snapshot.volume / 100);
      this.applyVolume();
    }
    if (patch.audioProcessing && this.raw.localParticipant.isMicrophoneEnabled) {
      const track = this.raw.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
      await track?.restartTrack(snapshot.audioProcessing);
    }
    return snapshot;
  }
  constructor(
    private readonly onDisconnected: () => void,
    private readonly api: ReturnType<typeof createNativeApi>,
  ) {
    this.media = createMediaController({
      status: (signal) => api.sdk.native.mediaStatus(this.details!.joinId, signal),
      authorize: (device, id, signal) =>
        api.sdk.native.enableMedia(this.details!.joinId, device, id, signal),
      enabled: (device) =>
        device === 'microphone'
          ? this.raw.localParticipant.isMicrophoneEnabled
          : device === 'screen'
            ? this.raw.localParticipant.isScreenShareEnabled
            : this.raw.localParticipant.isCameraEnabled,
      capture: async (device, enabled) => {
        if (enabled) await this.waitForPermission(device);
        if (device === 'microphone')
          await this.raw.localParticipant.setMicrophoneEnabled(
            enabled,
            this.settingsSnapshot?.audioProcessing,
          );
        else if (device === 'camera') await this.raw.localParticipant.setCameraEnabled(enabled);
        else {
          if (enabled) await this.showScreenPicker?.();
          await this.raw.localParticipant.setScreenShareEnabled(enabled, { audio: false });
        }
      },
    });
    this.raw.localParticipant.on(
      ParticipantEvent.ParticipantPermissionsChanged,
      this.permissionsChanged,
    );
    this.raw.on(RoomEvent.LocalTrackPublished, this.syncMedia);
    this.raw.on(RoomEvent.LocalTrackUnpublished, this.syncMedia);
    this.raw.on(RoomEvent.TrackMuted, this.syncMedia);
    this.raw.on(RoomEvent.TrackUnmuted, this.syncMedia);
    this.raw.on(RoomEvent.Disconnected, onDisconnected);
    this.raw.on(RoomEvent.TrackPublished, this.onPublication);
    this.raw.on(RoomEvent.TrackSubscribed, this.applyVolume);
    this.raw.on(RoomEvent.ParticipantConnected, this.previewPermissions);
    this.raw.on(RoomEvent.ParticipantDisconnected, this.previewPermissions);
  }
  async connect(details: NativeJoin) {
    this.details = details;
    await AudioSession.startAudioSession();
    await this.raw.connect(details.serverUrl, details.participantToken, { autoSubscribe: false });
    this.previewPermissions();
  }
  async subscribe() {
    await this.settings(this.captureAbort.signal);
    await AudioSession.setDefaultRemoteAudioTrackVolume(
      (this.settingsSnapshot?.volume ?? 100) / 100,
    );
    await this.refreshDirectory();
    this.subscribed = true;
    this.onPublication();
    this.directoryTimer = setInterval(() => {
      void this.refreshDirectory().catch((error) => {
        // Never keep receiving stale room subscriptions when membership cannot be verified.
        for (const participant of this.raw.remoteParticipants.values())
          for (const publication of participant.trackPublications.values())
            publication.setSubscribed(false);
        if (error instanceof ApiError && [401, 403, 404, 409].includes(error.status))
          this.onDisconnected();
      });
    }, 2000);
  }
  async disconnect() {
    this.subscribed = false;
    clearInterval(this.directoryTimer);
    this.raw.off(RoomEvent.Disconnected, this.onDisconnected);
    this.raw.off(RoomEvent.TrackPublished, this.onPublication);
    this.raw.off(RoomEvent.TrackSubscribed, this.applyVolume);
    this.raw.off(RoomEvent.ParticipantConnected, this.previewPermissions);
    this.raw.off(RoomEvent.ParticipantDisconnected, this.previewPermissions);
    // stop() invalidates pending permission/capture attempts before releasing this room.
    this.captureAbort.abort();
    let captureFailure: unknown;
    try {
      await this.media.stop();
    } catch (error) {
      captureFailure = error;
    }
    this.raw.localParticipant.off(
      ParticipantEvent.ParticipantPermissionsChanged,
      this.permissionsChanged,
    );
    this.raw.off(RoomEvent.LocalTrackPublished, this.syncMedia);
    this.raw.off(RoomEvent.LocalTrackUnpublished, this.syncMedia);
    this.raw.off(RoomEvent.TrackMuted, this.syncMedia);
    this.raw.off(RoomEvent.TrackUnmuted, this.syncMedia);
    try {
      await this.raw.disconnect();
      if (captureFailure) throw captureFailure;
    } finally {
      await AudioSession.stopAudioSession();
    }
  }
}
