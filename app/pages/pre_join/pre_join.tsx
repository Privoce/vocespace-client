import {
  MediaDeviceMenu,
  ParticipantPlaceholder,
  PreJoinProps,
  TrackToggle,
  usePersistentUserChoices,
  usePreviewTracks,
} from '@livekit/components-react';
import styles from '@/styles/pre_join.module.scss';
import React from 'react';
import { facingModeFromLocalTrack, LocalAudioTrack, LocalVideoTrack, Track } from 'livekit-client';
import { Input, message, Slider } from 'antd';
import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { useRecoilState } from 'recoil';
import { roomIdTmpState, userState } from '@/app/rooms/[roomName]/PageClientImpl';
import { connect_endpoint, src, ulid } from '@/lib/std';
import { useVideoBlur } from '@/lib/std/device';
import { LangSelect } from '@/app/devices/controls/lang_select';

const CONN_DETAILS_ENDPOINT = connect_endpoint('/api/room-settings');
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
}: PreJoinProps) {
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
  const [username, setUsername] = React.useState(userChoices.username);
  const [messageApi, contextHolder] = message.useMessage();
  // Save user choices to persistent storage ---------------------------------------------------------
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
  // Preview tracks -----------------------------------------------------------------------------------
  const tracks = usePreviewTracks(
    {
      audio: audioEnabled ? { deviceId: initialUserChoices.audioDeviceId } : false,
      video: videoEnabled
        ? { deviceId: initialUserChoices.videoDeviceId, processor: videoProcessor }
        : false,
    },
    onError,
  );
  // video track --------------------------------------------------------------------------------
  const videoEl = React.useRef(null);

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
    if (videoEl.current && videoTrack) {
      videoTrack.unmute();
      videoTrack.attach(videoEl.current);
    }

    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack]);
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
  const handleSubmit = async () => {
    const finalUserChoices = {
      username,
      videoEnabled,
      videoDeviceId,
      audioEnabled,
      audioDeviceId,
    };

    if (username === '') {
      messageApi.loading(t('msg.request.user.name'), 2);
      // 向服务器请求一个唯一的用户名
      const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
      // 获取roomId，从当前的url中
      const roomId = getRoomIdFromUrl();
      if (!roomId) return;
      url.searchParams.append('roomId', roomId);
      url.searchParams.append('pre', 'true');
      const response = await fetch(url.toString());
      if (response.ok) {
        const { name } = await response.json();
        finalUserChoices.username = name;
        setUsername(name);
      } else {
        messageApi.error(`${t('msg.error.user.username.request')}: ${response.statusText}`);
      }
    }

    if (typeof onSubmit === 'function') {
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
  return (
    <div className={styles.view}>
      {contextHolder}
      <span className={styles.view__lang_select}>
        <LangSelect></LangSelect>
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
            <ParticipantPlaceholder />
          </div>
        )}
      </div>
      <div className={styles.view__controls}>
        <div className={`${styles.view__controls__group} audio lk-button-group`}>
          <TrackToggle
            className={styles.view__controls__toggle}
            initialState={audioEnabled}
            source={Track.Source.Microphone}
            onChange={(enabled) => setAudioEnabled(enabled)}
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
            defaultValue={100}
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
            onChange={(enabled) => setVideoEnabled(enabled)}
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
            defaultValue={0.0}
            value={blur}
            onChange={(e) => {
              setBlur(e);
              setVideoBlur(e);
              setDevice({ ...device, blur: e });
            }}
          ></Slider>
        </div>
        <Input
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
    </div>
  );
}

// 从当前浏览器的URL中获取房间ID
const getRoomIdFromUrl = (): string | undefined => {
  // 获取当前URL
  const url = window.location.href;
  // 要获取roomId只需找到url中rooms/后面的部分到下一个/为止
  let end = url.indexOf('/', url.indexOf('rooms/') + 6);
  if (end == -1) {
    end = url.length;
  }
  const roomId = url.substring(url.indexOf('rooms/') + 6, end);

  if (roomId === '') {
    return undefined;
  } else {
    return roomId;
  }
};
