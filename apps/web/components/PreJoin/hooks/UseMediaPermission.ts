'use client';
import { useI18n } from '@/lib/i18n/i18n';
import type { MessageInstance } from 'antd/es/message/interface';
import React,{ useEffect } from 'react';
type MediaPermissionState = PermissionState | 'unsupported';

export function useMediaPermissions({ setAudioEnabled, setVideoEnabled, messageApi }: {
  setAudioEnabled: (enabled: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;
  messageApi: MessageInstance;
}) {
  const { t } = useI18n();
  const grantedFallback = React.useRef({ camera: false, microphone: false });
  const [hasCameraDevice, setHasCameraDevice] = React.useState(true);
  const [hasMicrophoneDevice, setHasMicrophoneDevice] = React.useState(true);
  const [cameraPermission, setCameraPermission] = React.useState<MediaPermissionState>('prompt');
  const [microphonePermission, setMicrophonePermission] =
    React.useState<MediaPermissionState>('prompt');
  const [permissionModalVisible, setPermissionModalVisible] = React.useState(false);
  const [permissionPromptDismissed, setPermissionPromptDismissed] = React.useState(false);
  const [hasCheckedPermissions, setHasCheckedPermissions] = React.useState(false);
  useEffect(() => {
    let isMounted = true;
    const permissionStatusCleanups: Array<() => void> = [];

    const queryPermission = async (
      name: 'camera' | 'microphone',
      watch = false,
    ): Promise<MediaPermissionState> => {
      if (!navigator.permissions?.query) {
        return grantedFallback.current[name] ? 'granted' : 'unsupported';
      }

      try {
        const result = await navigator.permissions.query({
          name: name as PermissionName,
        });

        if (watch && isMounted) {
          const handlePermissionChange = () => {
            void syncPermissions(false);
          };

          result.addEventListener('change', handlePermissionChange);
          permissionStatusCleanups.push(() => {
            result.removeEventListener('change', handlePermissionChange);
          });
        }

        return result.state;
      } catch (error) {
        console.warn(`permission query fail: ${name}`, error);
        return grantedFallback.current[name] ? 'granted' : 'unsupported';
      }
    };

    const syncPermissions = async (watchPermissions = false) => {
      try {
        const canQueryDevices = typeof navigator.mediaDevices?.enumerateDevices === 'function';
        const devices = canQueryDevices ? await navigator.mediaDevices.enumerateDevices() : [];
        const hasCamera = devices.some((device) => device.kind === 'videoinput');
        const hasMicrophone = devices.some((device) => device.kind === 'audioinput');
        const canRequestMedia = typeof navigator.mediaDevices?.getUserMedia === 'function';
        const assumeMediaDevicesExist = canRequestMedia && devices.length === 0;
        const nextHasCamera = hasCamera || assumeMediaDevicesExist;
        const nextHasMicrophone = hasMicrophone || assumeMediaDevicesExist;

        if (!isMounted) {
          return;
        }

        setHasCameraDevice(nextHasCamera);
        setHasMicrophoneDevice(nextHasMicrophone);

        const [nextCameraPermission, nextMicrophonePermission] = await Promise.all([
          nextHasCamera
            ? queryPermission('camera', watchPermissions)
            : Promise.resolve('denied' as PermissionState),
          nextHasMicrophone
            ? queryPermission('microphone', watchPermissions)
            : Promise.resolve('denied' as PermissionState),
        ]);

        if (!isMounted) {
          return;
        }

        setCameraPermission((current) => nextCameraPermission === 'unsupported' && current === 'granted' ? current : nextCameraPermission);
        setMicrophonePermission((current) => nextMicrophonePermission === 'unsupported' && current === 'granted' ? current : nextMicrophonePermission);
        setHasCheckedPermissions(true);

        if (!nextHasCamera) {
          setVideoEnabled(false);
        }
        if (!nextHasMicrophone) {
          setAudioEnabled(false);
        }

        const hasMissingPermission =
          (nextHasCamera && nextCameraPermission !== 'granted') ||
          (nextHasMicrophone && nextMicrophonePermission !== 'granted');
        const shouldAskPermission =
          !permissionPromptDismissed && canRequestMedia && hasMissingPermission;

        if (!hasMissingPermission) {
          setPermissionPromptDismissed(false);
        }

        setPermissionModalVisible(shouldAskPermission);
      } catch (error) {
        console.error('device check fail:', error);
        const canRequestMedia = typeof navigator.mediaDevices?.getUserMedia === 'function';

        if (!isMounted) {
          return;
        }

        setHasCheckedPermissions(true);
        setHasCameraDevice(canRequestMedia);
        setHasMicrophoneDevice(canRequestMedia);
        setCameraPermission(canRequestMedia ? 'prompt' : 'denied');
        setMicrophonePermission(canRequestMedia ? 'prompt' : 'denied');
        setPermissionModalVisible(canRequestMedia && !permissionPromptDismissed);
      }
    };

    const handleFocus = () => {
      void syncPermissions(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncPermissions(false);
      }
    };

    void syncPermissions(true);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      permissionStatusCleanups.forEach((cleanup) => cleanup());
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [permissionPromptDismissed, setAudioEnabled, setVideoEnabled]);

  const hasCameraPermission = !hasCameraDevice || cameraPermission === 'granted';
  const hasMicrophonePermission = !hasMicrophoneDevice || microphonePermission === 'granted';
  const missingPermissions = [
    hasCameraDevice && !hasCameraPermission ? t('common.device.camera') : null,
    hasMicrophoneDevice && !hasMicrophonePermission ? t('common.device.microphone') : null,
  ].filter(Boolean) as string[];

  const permissionPlaceholderText = React.useMemo(() => {
    if (!hasCheckedPermissions) {
      return t('msg.request.device.pre_join.checking');
    }
    if (missingPermissions.length > 0) {
      return `${t('msg.request.device.pre_join.permission_prefix')}${missingPermissions.join(
        t('msg.request.device.pre_join.permission_joiner'),
      )}`;
    }
    if (!hasCameraDevice) {
      return t('msg.request.device.pre_join.no_camera');
    }
    return t('msg.request.device.pre_join.camera_off');
  }, [hasCheckedPermissions, hasCameraDevice, missingPermissions, t]);

  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: hasMicrophoneDevice,
        video: hasCameraDevice,
      });

      stream.getTracks().forEach((track) => track.stop());

      if (hasCameraDevice) {
        grantedFallback.current.camera = true;
        setCameraPermission('granted');
      }
      if (hasMicrophoneDevice) {
        grantedFallback.current.microphone = true;
        setMicrophonePermission('granted');
      }

      setPermissionPromptDismissed(false);
      setPermissionModalVisible(false);
      messageApi.success(t('msg.success.device.granted'));
    } catch (error) {
      console.error('request media permissions fail:', error);
      if (hasCameraDevice) {
        setCameraPermission('denied');
      }
      if (hasMicrophoneDevice) {
        setMicrophonePermission('denied');
      }
      messageApi.error(t('msg.error.device.media_not_granted'));
    }
  };

  const continueWithoutPermissions = () => {
    if (!hasCameraPermission) {
      setVideoEnabled(false);
    }
    if (!hasMicrophonePermission) {
      setAudioEnabled(false);
    }
    setPermissionPromptDismissed(true);
    setPermissionModalVisible(false);
  };

  const handleAudioToggleChange = (enabled: boolean) => {
    if (enabled && !hasMicrophonePermission) {
      setPermissionModalVisible(true);
      return;
    }
    setAudioEnabled(enabled);
  };

  const handleVideoToggleChange = (enabled: boolean) => {
    if (enabled && !hasCameraPermission) {
      setPermissionModalVisible(true);
      return;
    }
    setVideoEnabled(enabled);
  };

  return { hasCameraPermission, hasMicrophonePermission, permissionModalVisible,
    missingPermissions, permissionPlaceholderText, requestMediaPermissions,
    continueWithoutPermissions, handleAudioToggleChange, handleVideoToggleChange };
}
