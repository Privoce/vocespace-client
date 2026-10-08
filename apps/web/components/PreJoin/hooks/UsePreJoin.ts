'use client';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import { useVideoBlur } from '@/lib/std/device';
import { useUserStore } from '@/lib/store';
import { usePersistentUserChoices, usePreviewTracks } from '@livekit/components-react';
import { message, type InputRef } from 'antd';
import { facingModeFromLocalTrack, LocalAudioTrack, LocalVideoTrack, Track } from 'livekit-client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import type { PreJoinPropsExt } from '../types';
import { PreJoinError, validatePreJoin } from './vaildate';
import { useMediaPermissions } from './UseMediaPermission';

export function usePreJoin({
  defaults = {},
  persistUserChoices = true,
  videoProcessor,
  onSubmit,
  onError,
  micLabel,
  camLabel,
  userLabel,
  joinLabel,
  data,
  loading,
  space,
  setLoading,
  config,
}: PreJoinPropsExt) {
  const { t } = useI18n();
  const device = useLayoutDevice();
  const router = useRouter();
  const active = React.useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  // user choices -------------------------------------------------------------------------------------
  const {
    userChoices: initialUserChoices,
    saveAudioInputDeviceId,
    saveAudioInputEnabled,
    saveVideoInputDeviceId,
    saveVideoInputEnabled,
    saveUsername,
  } = usePersistentUserChoices({
    defaults,
    preventSave: !persistUserChoices,
    preventLoad: !persistUserChoices,
  });
  const userChoices = initialUserChoices;
  // Initialize device settings -----------------------------------------------------------------------
  const [audioEnabled, setAudioEnabled] = React.useState<boolean>(userChoices.audioEnabled);
  const [videoEnabled, setVideoEnabled] = React.useState<boolean>(userChoices.videoEnabled);
  const [audioDeviceId, setAudioDeviceId] = React.useState<string>(userChoices.audioDeviceId);
  const [videoDeviceId, setVideoDeviceId] = React.useState<string>(userChoices.videoDeviceId);
  const [messageApi, contextHolder] = message.useMessage();
  const [username, setUsername] = React.useState<string>(
    data?.username || userChoices.username || '',
  );
  // Save user choices to persistent storage ---------------------------------------------------------
  React.useEffect(() => {
    if (data?.username) {
      setUsername(data.username);
    }
  }, [data?.username]);
  React.useEffect(() => {
    saveAudioInputEnabled(audioEnabled);
  }, [audioEnabled, saveAudioInputEnabled]);
  React.useEffect(() => {
    saveVideoInputEnabled(videoEnabled);
  }, [videoEnabled, saveVideoInputEnabled]);
  React.useEffect(() => {
    saveAudioInputDeviceId(audioDeviceId);
  }, [audioDeviceId, saveAudioInputDeviceId]);
  React.useEffect(() => {
    saveVideoInputDeviceId(videoDeviceId);
  }, [videoDeviceId, saveVideoInputDeviceId]);
  React.useEffect(() => {
    saveUsername(username);
  }, [username, saveUsername]);

  const showLoginBtn = useMemo(() => {
    return !data;
  }, [data]);

  const permissions = useMediaPermissions({ setAudioEnabled, setVideoEnabled, messageApi });
  const { hasCameraPermission, hasMicrophonePermission } = permissions;

  // Preview tracks -----------------------------------------------------------------------------------
  const tracks = usePreviewTracks(
    {
      audio: audioEnabled && hasMicrophonePermission ? { deviceId: audioDeviceId } : false,
      video:
        videoEnabled && hasCameraPermission
          ? { deviceId: videoDeviceId, processor: videoProcessor }
          : false,
    },
    onError,
  );
  // video track --------------------------------------------------------------------------------
  const videoEl = React.useRef<HTMLVideoElement>(null);
  const inputRef = React.useRef<InputRef>(null);
  const videoTrack = React.useMemo(
    () => tracks?.filter((track) => track.kind === Track.Kind.Video)[0] as LocalVideoTrack,
    [tracks],
  );

  const facingMode = React.useMemo(() => {
    if (videoTrack) {
      const { facingMode } = facingModeFromLocalTrack(videoTrack);
      return facingMode;
    } else {
      return 'undefined';
    }
  }, [videoTrack]);

  React.useEffect(() => {
    if (videoEl.current && videoTrack && !loading) {
      videoTrack.unmute();
      videoTrack.attach(videoEl.current);
      // 自动聚焦input
      if (inputRef.current && device === 'pc') {
        inputRef.current.focus();
      }
    }

    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack, inputRef, loading, device]);
  // audio track --------------------------------------------------------------------------------------
  const audioTrack = React.useMemo(
    () => tracks?.filter((track) => track.kind === Track.Kind.Audio)[0] as LocalAudioTrack,
    [tracks],
  );
  // handle submit --------------------------------------------------------------------------------
  const [spinning, setSpinning] = useState(false);
  const submitting = React.useRef(false);
  const handleSubmit = async () => {
    if (submitting.current || !space) return;
    submitting.current = true;
    setSpinning(true);
    try {
      const finalUserChoices = await validatePreJoin({
        space,
        username,
        data,
        audioEnabled: audioEnabled && hasMicrophonePermission,
        videoEnabled: videoEnabled && hasCameraPermission,
        audioDeviceId,
        videoDeviceId,
      });
      if (!active.current) return;
      setUsername(finalUserChoices.username);
      await onSubmit?.(finalUserChoices);
    } catch (error) {
      if (!active.current) return;
      messageApi.error(
        error instanceof PreJoinError ? t(error.messageKey) : t('msg.error.room.unexpect'),
      );
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      submitting.current = false;
      if (active.current) setSpinning(false);
    }
  };

  // volume --------------------------------------------------------------------------------------
  const savedDevice = useUserStore();
  const [volume, setVolume] = React.useState(savedDevice.volume);
  const [blur, setBlur] = React.useState(savedDevice.blur);
  const [play, setPlay] = React.useState(false);
  const audio_play_ref = React.useRef<HTMLAudioElement>(null);
  const { blurValue, setVideoBlur } = useVideoBlur({
    videoRef: videoEl,
    initialBlur: savedDevice.blur,
    defaultDimensions: { height: 280, width: 448 },
  });
  // [play] ------------------------------------------------------------------------
  const play_sound = async () => {
    if (!audio_play_ref) return;
    if (audio_play_ref.current?.paused) {
      audio_play_ref.current.currentTime = 0;
      audio_play_ref.current.volume = volume / 100.0;
      try {
        await audio_play_ref.current.play();
        setPlay(true);
      } catch {
        setPlay(false);
      }
    } else {
      audio_play_ref.current?.pause();
      setPlay(false);
    }
  };

  useEffect(() => {
    if (savedDevice.volume !== volume) {
      setVolume(savedDevice.volume);
    }
    if (savedDevice.blur !== blur) {
      setBlur(savedDevice.blur);
      setVideoBlur(savedDevice.blur);
    }
  }, [savedDevice, volume, blur, setVideoBlur]);

  const changeVolume = (value: number) => {
    setVolume(value);
    useUserStore.setState({ volume: value });
  };
  const changeBlur = (value: number) => {
    setBlur(value);
    setVideoBlur(value);
    useUserStore.setState({ blur: value });
  };
  const goHome = () => router.push('/new_space');
  return {
    t,
    device,
    permissions,
    contextHolder,
    spinning,
    loading,
    data,
    config,
    space,
    micLabel,
    camLabel,
    userLabel,
    joinLabel,
    videoTrack,
    videoEnabled,
    videoEl,
    facingMode,
    blurValue,
    audioEnabled,
    audioDeviceId,
    audioTrack,
    setAudioDeviceId,
    volume,
    changeVolume,
    audio_play_ref,
    play_sound,
    play,
    setPlay,
    videoDeviceId,
    setVideoDeviceId,
    blur,
    changeBlur,
    showLoginBtn,
    inputRef,
    username,
    setUsername,
    handleSubmit,
    goHome,
  };
}
export type PreJoinModel = ReturnType<typeof usePreJoin>;
