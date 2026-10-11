import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { AudioSession } from '@livekit/react-native';
import { Room } from 'livekit-client';
import type { NativeRoom } from './room';

type Kind = 'audioinput' | 'videoinput' | 'audiooutput';
type Device = { deviceId: string; label: string };
/** Enumerating never starts capture. LiveKit switches only an already published track. */
export function useNativeDevices(room: NativeRoom) {
  const [devices, setDevices] = useState<Record<Kind, Device[]>>({
    audioinput: [],
    videoinput: [],
    audiooutput: [],
  });
  const [selected, setSelected] = useState<Partial<Record<Kind, string>>>({});
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const flight = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    const result = await Promise.allSettled([
      Room.getLocalDevices('audioinput', false),
      Room.getLocalDevices('videoinput', false),
      AudioSession.getAudioOutputs(),
    ]);
    if (!active.current || version !== generation.current) return;
    setError(result.some((item) => item.status === 'rejected'));
    const inputs = result[0].status === 'fulfilled' ? result[0].value : [];
    const cameras = result[1].status === 'fulfilled' ? result[1].value : [];
    const outputs =
      result[2].status === 'fulfilled'
        ? result[2].value.map((deviceId) => ({ deviceId, label: deviceId }))
        : [];
    setDevices({ audioinput: inputs, videoinput: cameras, audiooutput: outputs });
    setSelected((previous) => ({
      audioinput: inputs.some((d) => d.deviceId === previous.audioinput)
        ? previous.audioinput
        : inputs[0]?.deviceId,
      videoinput: cameras.some((d) => d.deviceId === previous.videoinput)
        ? previous.videoinput
        : cameras[0]?.deviceId,
      audiooutput: outputs.some((d) => d.deviceId === previous.audiooutput)
        ? previous.audiooutput
        : outputs[0]?.deviceId,
    }));
  }, []);
  useEffect(() => {
    active.current = true;
    void refresh();
    const update = () => {
      void refresh();
    };
    room.raw.on('mediaDevicesChanged', update);
    return () => {
      active.current = false;
      generation.current++;
      room.raw.off('mediaDevicesChanged', update);
    };
  }, [refresh, room]);
  const select = async (kind: Kind, id: string) => {
    if (flight.current || !devices[kind].some((d) => d.deviceId === id)) return;
    flight.current = true;
    setBusy(true);
    setError(false);
    try {
      if (kind === 'audiooutput') await AudioSession.selectAudioOutput(id);
      else if (!(await room.raw.switchActiveDevice(kind, id)))
        throw new Error('DEVICE_SWITCH_FAILED');
      if (active.current) setSelected((previous) => ({ ...previous, [kind]: id }));
    } catch {
      if (active.current) setError(true);
    } finally {
      flight.current = false;
      if (active.current) setBusy(false);
    }
  };
  return {
    devices,
    selected,
    error,
    busy,
    refresh,
    select,
    routePicker:
      Platform.OS === 'ios'
        ? async () => {
            try {
              await AudioSession.showAudioRoutePicker();
            } catch {
              if (active.current) setError(true);
            }
          }
        : undefined,
  };
}
