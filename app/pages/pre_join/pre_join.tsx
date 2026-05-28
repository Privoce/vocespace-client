'use client';

import {
  MediaDeviceMenu,
  PreJoinProps,
  TrackToggle,
  usePersistentUserChoices,
  usePreviewTracks,
} from '@livekit/components-react';
import styles from '@/styles/pre_join.module.scss';
import React, { useEffect, useMemo, useState } from 'react';
import { facingModeFromLocalTrack, LocalAudioTrack, LocalVideoTrack, Track } from 'livekit-client';
import { Input, InputRef, Modal, message, Skeleton, Slider, Space, Spin, Button } from 'antd';
import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { useRecoilState } from 'recoil';
import { userState } from '@/app/[spaceName]/PageClientImpl';
import { PlatformUser, src } from '@/lib/std';
import { useVideoBlur } from '@/lib/std/device';
import { LangSelect } from '@/app/pages/controls/selects/lang_select';
import { ulid } from 'ulid';
import { api } from '@/lib/api';
import { LoginButtons, LoginStateBtn } from './login';
import { SpaceInfo } from '@/lib/std/space';
import { ReadableConf, VocespaceConfig } from '@/lib/std/conf';

export interface PreJoinPropsExt extends PreJoinProps {
  data: PlatformUser | undefined;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  space: string;
  config: VocespaceConfig | ReadableConf;
}

type MediaPermissionState = PermissionState | 'unsupported';

/**
 * # PreJoin
 * PreJoin component for the app, which use before join a room
 * ## Features
 * - check and adjust their microphone and camera settings
 *   - test microphone and camera
 *   - test audio volume
 *   - test camera blur
 * - set username as a unique name (if not ask for server to generate an available name)
 * - set audio and video device
 * - set audio and video enabled
 * - set audio and video track
 * @param PreJoinProps
 */
export function PreJoin({
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
  const [userChoices, setUserChoices] = React.useState(initialUserChoices);
  // Initialize device settings -----------------------------------------------------------------------
  const [audioEnabled, setAudioEnabled] = React.useState<boolean>(userChoices.audioEnabled);
  const [videoEnabled, setVideoEnabled] = React.useState<boolean>(userChoices.videoEnabled);
  const [audioDeviceId, setAudioDeviceId] = React.useState<string>(userChoices.audioDeviceId);
  const [videoDeviceId, setVideoDeviceId] = React.useState<string>(userChoices.videoDeviceId);
  const [hasCameraDevice, setHasCameraDevice] = React.useState(true);
  const [hasMicrophoneDevice, setHasMicrophoneDevice] = React.useState(true);
  const [cameraPermission, setCameraPermission] = React.useState<MediaPermissionState>('prompt');
  const [microphonePermission, setMicrophonePermission] =
    React.useState<MediaPermissionState>('prompt');
  const [permissionModalVisible, setPermissionModalVisible] = React.useState(false);
  const [permissionPromptDismissed, setPermissionPromptDismissed] = React.useState(false);
  const [hasCheckedPermissions, setHasCheckedPermissions] = React.useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [username, setUsername] = React.useState<string>(
    data?.username || userChoices.username || '',
  );
  // Save user choices to persistent storage ---------------------------------------------------------
  React.useEffect(() => {
    if (data?.username && data?.username !== username) {
      setUsername(data.username);
    }
  }, [data]);
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

  useEffect(() => {
    let isMounted = true;
    const permissionStatusCleanups: Array<() => void> = [];

    const queryPermission = async (
      name: 'camera' | 'microphone',
      watch = false,
    ): Promise<MediaPermissionState> => {
      if (!navigator.permissions?.query) {
        return 'unsupported';
      }

      try {
        const result = await navigator.permissions.query({
          name: name as PermissionName,
        });

        if (watch) {
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
        return 'unsupported';
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

        setCameraPermission(nextCameraPermission);
        setMicrophonePermission(nextMicrophonePermission);
        setHasCheckedPermissions(true);

        if (!nextHasCamera && videoEnabled) {
          setVideoEnabled(false);
        }
        if (!nextHasMicrophone && audioEnabled) {
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
  }, [permissionPromptDismissed]);

  const showLoginBtn = useMemo(() => {
    return !data;
  }, [data]);

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
  }, [hasCheckedPermissions, hasCameraDevice, hasCameraPermission, missingPermissions, t]);

  // Preview tracks -----------------------------------------------------------------------------------
  const tracks = usePreviewTracks(
    {
      audio:
        audioEnabled && hasMicrophonePermission ? { deviceId: userChoices.audioDeviceId } : false,
      video:
        videoEnabled && hasCameraPermission
          ? { deviceId: userChoices.videoDeviceId, processor: videoProcessor }
          : false,
    },
    onError,
  );
  // video track --------------------------------------------------------------------------------
  const videoEl = React.useRef(null);
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
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }

    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack, inputRef, loading]);
  // audio track --------------------------------------------------------------------------------------
  const audioTrack = React.useMemo(
    () => tracks?.filter((track) => track.kind === Track.Kind.Audio)[0] as LocalAudioTrack,
    [tracks],
  );
  React.useEffect(() => {
    // 仅当 username 不为空时更新 userChoices
    if (username) {
      const newUserChoices = {
        username,
        videoEnabled,
        videoDeviceId,
        audioEnabled,
        audioDeviceId,
      };
      setUserChoices(newUserChoices);
    }
  }, [username, videoEnabled, videoDeviceId, audioEnabled, audioDeviceId]);
  // handle submit --------------------------------------------------------------------------------
  const [spinning, setSpinning] = useState(false);
  const [percent, setPercent] = useState(0);
  const showLoader = () => {
    setSpinning(true);
    let ptg = 0;

    const interval = setInterval(() => {
      ptg += 5;
      setPercent(ptg);

      if (ptg > 100) {
        clearInterval(interval);
        setSpinning(false);
        setPercent(0);
      }
    }, 200);
  };
  const handleSubmit = async () => {
    const finalUserChoices = {
      username,
      videoEnabled,
      videoDeviceId,
      audioEnabled,
      audioDeviceId,
    };
    // 获取spaceName，从当前的url中
    const spaceName = getSpaceNameFromUrl();
    if (!spaceName) return;

    if (username === '') {
      messageApi.loading(t('msg.request.user.name'), 2);
      // 向服务器请求一个唯一的用户名
      const response = await api.getUniqueUsername(spaceName);
      if (response.ok) {
        const { name } = await response.json();
        finalUserChoices.username = name;
        setUsername(name);
      } else {
        messageApi.error(`${t('msg.error.user.username.request')}: ${response.statusText}`);
      }
    } else {
      // 虽然用户名不为空，但依然需要验证是否唯一
      const response = await api.checkUsername(spaceName, username, data?.id);
      if (response.ok) {
        const { success, name } = await response.json();
        setUsername(name);
        finalUserChoices.username = name;
        if (!success) {
          messageApi.error({
            content: t('msg.error.user.username.exist'),
          });
          return;
        }
      }
    }

    // 加入空间前还需要确定当前空间是否允许游客加入
    const response = await api.getSpaceInfo(spaceName);
    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.status}`);
    }
    const { settings: spaceInfo }: { settings?: SpaceInfo } = await response.json();

    let allowGuest = (spaceInfo?.allowGuest && spaceInfo.allowGuest === 'allow') || true;
    // 有房间且房间不允许游客加入
    if (spaceInfo && !allowGuest && data?.identity === 'guest') {
      messageApi.error(t('common.guest.not_allow'));
      return;
    }

    if (typeof onSubmit === 'function') {
      showLoader();
      onSubmit(finalUserChoices);
    }
  };

  // volume --------------------------------------------------------------------------------------
  const [device, setDevice] = useRecoilState(userState);
  const [volume, setVolume] = React.useState(device.volume);
  const [blur, setBlur] = React.useState(device.blur);
  const [play, setPlay] = React.useState(false);
  const audio_play_ref = React.useRef<HTMLAudioElement>(null);
  const { blurValue, setVideoBlur } = useVideoBlur({
    videoRef: videoEl,
    initialBlur: 0.0,
    defaultDimensions: { height: 280, width: 448 },
  });
  // [play] ------------------------------------------------------------------------
  const play_sound = () => {
    if (!audio_play_ref) return;
    if (audio_play_ref.current?.paused) {
      audio_play_ref.current.currentTime = 0;
      audio_play_ref.current.volume = volume / 100.0;
      audio_play_ref.current?.play();
      setPlay(true);
    } else {
      audio_play_ref.current?.pause();
      setPlay(false);
    }
  };

  useEffect(() => {
    if (device.volume !== volume) {
      setVolume(device.volume);
    }
    if (device.blur !== blur) {
      setBlur(device.blur);
      setVideoBlur(device.blur);
    }
  }, [device, volume, blur]);

  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: hasMicrophoneDevice,
        video: hasCameraDevice,
      });

      stream.getTracks().forEach((track) => track.stop());

      if (hasCameraDevice) {
        setCameraPermission('granted');
      }
      if (hasMicrophoneDevice) {
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
      if (!permissionPromptDismissed) {
        setPermissionModalVisible(true);
      }
      return;
    }
    setAudioEnabled(enabled);
  };

  const handleVideoToggleChange = (enabled: boolean) => {
    if (enabled && !hasCameraPermission) {
      if (!permissionPromptDismissed) {
        setPermissionModalVisible(true);
      }
      return;
    }
    setVideoEnabled(enabled);
  };

  return (
    <div className={styles.view}>
      {contextHolder}
      <Spin spinning={spinning} percent={percent} fullscreen />
      <Modal
        open={permissionModalVisible}
        centered
        closable={true}
        maskClosable={false}
        title={t('msg.request.device.pre_join.modal_title')}
        onOk={requestMediaPermissions}
        onCancel={continueWithoutPermissions}
        footer={[
          <Button type="primary" key={"request"} onClick={requestMediaPermissions}>
            {t('msg.request.device.pre_join.allow_media')}
          </Button>,
        ]}
      >
        <div className={styles.view__permission_modal__content}>
          <p>{t('msg.request.device.pre_join.modal_desc')}</p>
          {missingPermissions.length > 0 && (
            <p>
              {t('msg.request.device.pre_join.current_permission_prefix')}
              {missingPermissions.join(t('msg.request.device.pre_join.permission_joiner'))}
            </p>
          )}
        </div>
      </Modal>
      <span className={styles.view__lang_select}>
        {loading ? (
          <Skeleton.Node
            active
            style={{ height: `40px`, backgroundColor: '#333', width: '126px' }}
          ></Skeleton.Node>
        ) : (
          <LangSelect></LangSelect>
        )}
      </span>
      <div className={styles.view__video}>
        {videoTrack && videoEnabled && (
          <video
            ref={videoEl}
            data-lk-facing-mode={facingMode}
            style={{
              height: '100%',
              width: '100%',
              filter: `blur(${blurValue}px)`,
            }}
          />
        )}
        {(!videoTrack || !videoEnabled) && (
          <div className={styles.view__video__placeholder}>
            <p className={styles.view__video__permission}>{permissionPlaceholderText}</p>
          </div>
        )}
      </div>
      {loading ? (
        <div className={styles.view__controls}>
          <Space direction="vertical" size={'small'} style={{ width: '100%' }}>
            {[44, 136, 44, 92.4, 44, 44].map((h) => (
              <Skeleton.Input
                key={ulid()}
                active
                style={{ height: `${h}px`, backgroundColor: '#333' }}
                block
              ></Skeleton.Input>
            ))}
          </Space>
        </div>
      ) : (
        <div className={styles.view__controls}>
          <div className={`${styles.view__controls__group} audio lk-button-group`}>
            <TrackToggle
              className={styles.view__controls__toggle}
              initialState={audioEnabled}
              source={Track.Source.Microphone}
              onChange={handleAudioToggleChange}
            >
              {micLabel}
            </TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu
                initialSelection={audioDeviceId}
                kind="audioinput"
                disabled={!audioTrack}
                tracks={{ audioinput: audioTrack }}
                onActiveDeviceChange={(_, id) => setAudioDeviceId(id)}
              />
            </div>
          </div>
          <div className={styles.view__controls__group_volume}>
            <div className={styles.view__controls__group_volume__header}>
              <div className={styles.view__controls__group_volume__header__left}>
                <SvgResource type="volume" svgSize={18}></SvgResource>
                <span>{t('common.device.volume')}</span>
              </div>
              <span>{volume}</span>
              <audio
                ref={audio_play_ref}
                src={src('/audios/pre_test.mp3')}
                style={{ display: 'none' }}
              ></audio>
            </div>
            <Slider
              min={0.0}
              max={100.0}
              step={1}
              defaultValue={80}
              value={volume}
              onChange={(e) => {
                setVolume(e);
                setDevice({ ...device, volume: e });
              }}
            ></Slider>
            <button
              style={{ backgroundColor: '#22CCEE' }}
              className={styles.view__controls__group_volume__button}
              onClick={play_sound}
            >
              {!play ? t('common.device.test.audio') : t('common.device.test.close_audio')}
            </button>
          </div>
          <div className={`${styles.view__controls__group} video lk-button-group`}>
            <TrackToggle
              className={styles.view__controls__toggle}
              initialState={videoEnabled}
              source={Track.Source.Camera}
              onChange={handleVideoToggleChange}
            >
              {camLabel}
            </TrackToggle>
            <div className="lk-button-group-menu">
              <MediaDeviceMenu
                initialSelection={videoDeviceId}
                kind="videoinput"
                disabled={!videoTrack}
                tracks={{ videoinput: videoTrack }}
                onActiveDeviceChange={(_, id) => setVideoDeviceId(id)}
              />
            </div>
          </div>
          <div className={styles.view__controls__group_volume}>
            <div className={styles.view__controls__group_volume__header}>
              <div className={styles.view__controls__group_volume__header__left}>
                <SvgResource type="video" svgSize={18}></SvgResource>
                <span>{t('common.device.blur')}</span>
              </div>
              <span>{Math.round(blur * 100.0)}%</span>
            </div>
            <Slider
              min={0.0}
              max={1.0}
              step={0.01}
              value={blur}
              onChange={(e) => {
                setBlur(e);
                setVideoBlur(e);
                setDevice({ ...device, blur: e });
              }}
            ></Slider>
          </div>
          {showLoginBtn && <LoginButtons serverUrl={config.serverUrl} space={space}></LoginButtons>}
          <Input
            ref={inputRef}
            size="large"
            style={{ width: '100%' }}
            id="username"
            name="username"
            type="text"
            placeholder={userLabel}
            value={username}
            onChange={(inputEl) => {
              setUsername(inputEl.target.value);
            }}
            autoComplete="off"
          />
          <button
            style={{ backgroundColor: '#22CCEE' }}
            className={styles.view__controls__form__button}
            type="submit"
            onClick={handleSubmit}
          >
            {joinLabel}
          </button>
        </div>
      )}
      <LoginStateBtn data={data} />
    </div>
  );
}

// 从当前浏览器的URL中获取空间名称
const getSpaceNameFromUrl = (): string | undefined => {
  // 获取当前URL
  const url = window.location.href;
  // 要获取spaceName只需找到url中最后一个'/'
  let end = url.lastIndexOf('/');
  if (end == -1) {
    end = url.length;
  }
  const spaceName = url.substring(end + 1, url.length);

  if (spaceName === '') {
    return undefined;
  } else {
    return spaceName;
  }
};
