'use client';

import { decodePassphrase } from '@/lib/client_utils';
import { createRTCQulity,type ReadableConf } from '@/lib/std/conf';
import type { LocalUserChoices } from '@livekit/components-react';
import { ExternalE2EEKeyProvider,Room,type RoomConnectOptions,type RoomOptions,type VideoCodec } from 'livekit-client';
import { useEffect,useRef,useState } from 'react';

interface ConnectionProps {
  config: ReadableConf;
  userChoices: LocalUserChoices;
  options: { hq: boolean; codec: VideoCodec };
  onError: (error: Error) => void;
}
export interface RoomConnection {
  room: Room;
  connectOptions: RoomConnectOptions;
}

/** Capture session options once; changing layout cannot replace media resources. */
export function useRoomConnection(props: ConnectionProps) {
  const initial = useRef(props).current;
  const reportError = useRef(props.onError);
  reportError.current = props.onError;
  const [session, setSession] = useState<RoomConnection>();
  const [e2eeSetupComplete, setE2eeSetupComplete] = useState(false);

  useEffect(() => {
    let active = true;
    let room: Room | undefined;
    let worker: Worker | undefined;
    setE2eeSetupComplete(false);
    try {
      const passphrase = decodePassphrase(window.location.hash.slice(1));
      const keyProvider = new ExternalE2EEKeyProvider();
      if (passphrase) worker = new Worker(new URL('livekit-client/e2ee-worker', import.meta.url));
      const { config, userChoices, options } = initial;
      const resolutions = createRTCQulity({ resolution: config.resolution, maxBitrate: config.maxBitrate,
        maxFramerate: config.maxFramerate, priority: config.priority }, 3);
      let videoCodec: VideoCodec | undefined = config.codec ?? 'vp9';
      if (passphrase && (videoCodec === 'av1' || videoCodec === 'vp9')) videoCodec = undefined;
      const roomOptions: RoomOptions = {
        videoCaptureDefaults: { deviceId: userChoices.videoDeviceId || undefined, resolution: options.hq ? resolutions[0] : resolutions[1] },
        publishDefaults: {
          dtx: false, videoSimulcastLayers: options.hq ? resolutions : [resolutions[1], resolutions[2]],
          red: !passphrase, videoCodec,
          screenShareEncoding: { maxBitrate: config.maxBitrate ?? 3000000, maxFramerate: config.maxFramerate ?? 30, priority: 'medium' },
          screenShareSimulcastLayers: resolutions,
        },
        audioCaptureDefaults: { deviceId: userChoices.audioDeviceId || undefined },
        adaptiveStream: { pixelDensity: 'screen' }, dynacast: true, disconnectOnPageLeave: false,
        e2ee: worker ? { keyProvider, worker } : undefined,
      };
      room = new Room(roomOptions);
      const connectOptions: RoomConnectOptions = { maxRetries: 5, autoSubscribe: true };
      if (config.livekit.turn?.length) {
        connectOptions.rtcConfig = { iceServers: config.livekit.turn, iceCandidatePoolSize: 20, iceTransportPolicy: 'all' };
      }
      setSession({ room, connectOptions });
      const currentRoom = room;
      const setup = async () => {
        if (passphrase) {
          await keyProvider.setKey(passphrase);
          if (!active) return;
          await currentRoom.setE2EEEnabled(true);
        }
        if (active) setE2eeSetupComplete(true);
      };
      void setup().catch((error) => {
        if (active) reportError.current(error instanceof Error ? error : new Error(String(error)));
      });
    } catch (error) {
      reportError.current(error instanceof Error ? error : new Error(String(error)));
    }
    return () => {
      active = false;
      if (room) void room.disconnect().catch(console.error);
      worker?.terminate();
    };
  }, [initial]);

  return { room: session?.room, connectOptions: session?.connectOptions, e2eeSetupComplete };
}
