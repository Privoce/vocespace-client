'use client';

import { DeviceList } from '@/lib/components/device-list';

import { Device, MediaDeviceKind } from '@/lib/livekit/devices';
import { supportsMediaDeviceChangeEvent } from '@/lib/browser/environment';
import { useMaybeRoomContext } from '@livekit/components-react';
import { LocalAudioTrack, LocalVideoTrack, RoomEvent } from 'livekit-client';
import { forwardRef, useCallback, useImperativeHandle, useState, useEffect } from 'react';

const DEVICE_REFRESH_RETRY_DELAYS = [250, 1000, 2500];
const DEVICE_REFRESH_INTERVAL = 2000;

export const DevicesSelector = forwardRef(
  (
    {
      enabled,
      track,
      kind,
      err,
      requestPermissions = true,
      onDeviceChanged,
      preferredDeviceId,
    }: DeviceSelectorProps,
    ref,
  ) => {
    const room = useMaybeRoomContext();
    const [deviceList, setDeviceList] = useState<Device[]>([]);
    const [activeDevice, setActiveDevice] = useState<string>('');

    const handleError = useCallback(
      (e: Error) => {
        if (room) {
          room.emit(RoomEvent.MediaDevicesError, e);
        }
        err?.(e);
      },
      [room, err],
    );

    const loadDevices = useCallback(async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
        setDeviceList([]);
        return;
      }

      try {
        console.warn('[DevicesSelector] loadDevices:start', {
          kind,
          enabled,
          requestPermissions,
        });

        if (enabled && requestPermissions && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: kind === MediaDeviceKind.AudioInput,
            video: kind === MediaDeviceKind.VideoInput,
          });
          stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        console.warn(
          '[DevicesSelector] enumerateDevices:raw',
          devices.map((device) => ({
            kind: device.kind,
            label: device.label,
            deviceId: device.deviceId,
            groupId: device.groupId,
          })),
        );
        const validDevices = devices
          .filter((device) => device.kind === kind && device.deviceId !== '')
          .map((device, index) => ({
            label:
              device.label ||
              `${kind === MediaDeviceKind.AudioInput ? 'Microphone' : 'Camera'} ${index + 1}`,
            value: device.deviceId,
          }));

        console.warn('[DevicesSelector] enumerateDevices:filtered', {
          kind,
          validDevices,
          activeFromRoom: room?.getActiveDevice(kind as globalThis.MediaDeviceKind) ?? '',
        });

        setDeviceList(validDevices);
        setActiveDevice((currentDevice) => {
          if (
            preferredDeviceId &&
            validDevices.some((device) => device.value === preferredDeviceId)
          ) {
            return preferredDeviceId;
          }

          const activeFromRoom = room?.getActiveDevice(kind as globalThis.MediaDeviceKind) ?? '';
          if (activeFromRoom && validDevices.some((device) => device.value === activeFromRoom)) {
            return activeFromRoom;
          }
          if (currentDevice && validDevices.some((device) => device.value === currentDevice)) {
            return currentDevice;
          }
          return validDevices[0]?.value ?? '';
        });
      } catch (e) {
        handleError(e as Error);
      }
    }, [enabled, handleError, kind, preferredDeviceId, requestPermissions, room]);

    useEffect(() => {
      if (!enabled) {
        return;
      }

      void loadDevices();

      const retryTimers = DEVICE_REFRESH_RETRY_DELAYS.map((delay) =>
        window.setTimeout(() => {
          void loadDevices();
        }, delay),
      );

      return () => {
        retryTimers.forEach((timer) => window.clearTimeout(timer));
      };
    }, [enabled, loadDevices]);

    useEffect(() => {
      if (!enabled || typeof navigator === 'undefined' || !navigator.mediaDevices) {
        return;
      }

      const handleDeviceChange = () => {
        console.warn('[DevicesSelector] mediaDevices.devicechange', { kind });
        void loadDevices();
      };

      const handleFocus = () => {
        console.warn('[DevicesSelector] window.focus', { kind });
        void loadDevices();
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.warn('[DevicesSelector] visibilitychange:visible', { kind });
          void loadDevices();
        }
      };

      const pollTimer = window.setInterval(() => {
        void loadDevices();
      }, DEVICE_REFRESH_INTERVAL);

      if (supportsMediaDeviceChangeEvent()) {
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      }
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        if (supportsMediaDeviceChangeEvent()) {
          navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        }
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.clearInterval(pollTimer);
      };
    }, [enabled, loadDevices]);

    // 处理设备切换
    const handleDeviceChange = async (deviceId: string) => {
      try {
        const exactMatch = deviceId !== 'default';
        console.warn('[DevicesSelector] handleDeviceChange', { kind, deviceId });
        if (track) {
          await track.setDeviceId(exactMatch ? { exact: deviceId } : deviceId);
        } else if (room) {
          await room.switchActiveDevice(
            kind as globalThis.MediaDeviceKind,
            deviceId,
            exactMatch,
          );
        }

        setActiveDevice(deviceId);
        onDeviceChanged?.(deviceId);
        void loadDevices();
      } catch (e) {
        handleError(e as Error);
      }
    };

    useImperativeHandle(ref, () => ({
      active_device: activeDevice,
    }));

    return (
      <DeviceList items={deviceList} activeValue={activeDevice} onSelect={handleDeviceChange} />
    );
  },
);
DevicesSelector.displayName = 'DevicesSelector';

export interface DeviceSelectorProps {
  enabled: boolean;
  track?: LocalAudioTrack | LocalVideoTrack;
  kind: MediaDeviceKind;
  err?: (e: Error) => void;
  requestPermissions?: boolean;
  onDeviceChanged?: (deviceId: string) => void;
  preferredDeviceId?: string;
}
