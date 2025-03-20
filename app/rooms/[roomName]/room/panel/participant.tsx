import {
  ConnectionQualityIndicator,
  isTrackReference,
  LayoutContext,
  LockLockedIcon,
  ParticipantName,
  ParticipantPlaceholder,
  ParticipantTile,
  PinState,
  ScreenShareIcon,
  TrackMutedIndicator,
  TrackReferenceOrPlaceholder,
  useEnsureTrackRef,
  useFeatureContext,
  useIsEncrypted,
  useMaybeLayoutContext,
  useMaybeRoomContext,
  usePersistentUserChoices,
  VideoTrack,
} from '@livekit/components-react';
import { ConnectionQuality, ConnectionState, Room, Track } from 'livekit-client';
import {
  forwardRef,
  HTMLAttributes,
  RefAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isTrackReferencePlaceholder } from '../video_container';
import { publisher, SubjectKey, subscriber } from '@/lib/std/chanel';
import styles from '@/styles/participant.module.scss';
import { use_add_user_device } from '@/lib/hooks/store/user_choices';
import { AddDeviceInfo, State, useVideoBlur } from '@/lib/std/device';
import { SvgResource, SvgType } from '../../pre_join/resources';
import { Badge, Dropdown, Input, MenuProps, Modal } from 'antd';
import { PresetStatusColorType } from 'antd/es/_util/colors';
import VirtualRoleCanvas from '../virtual_role/live2d';
import { HookAPI } from 'antd/es/modal/useModal';

interface ParticipantItemProps extends HTMLAttributes<HTMLDivElement> {
  trackRef?: TrackReferenceOrPlaceholder;
}

export function ParticipantItem({
  trackRef,
  ref,
  open_settings,
  ...htmlProps
}: ParticipantItemProps & RefAttributes<HTMLDivElement> & { open_settings: () => void }) {
  const {
    userChoices,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
    saveUsername,
  } = usePersistentUserChoices({ preventSave: false, preventLoad: false });
  const room = useMaybeRoomContext();
  // [refs] ------------------------------------------------------------------
  const video_track_ref = useRef<HTMLVideoElement>(null);
  const screen_track_ref = useRef<HTMLVideoElement>(null);
  const wave_audio_ref = useRef<HTMLAudioElement>(null);
  // [states] -----------------------------------------------------------------
  const [audio_enabled, set_audio_enabled] = useState(userChoices.audioEnabled);
  const [video_enabled, set_video_enabled] = useState(userChoices.videoEnabled);
  const [virtual, set_virtual] = useState(true);
  const [is_focus, set_is_focus] = useState(false);
  const isEncrypted = useIsEncrypted(trackRef?.participant);
  const add_derivce_settings = useMemo(() => {
    return use_add_user_device(room?.localParticipant.name || userChoices.username);
  }, []);
  const { blurValue, setVideoBlur } = useVideoBlur({
    videoRef: video_track_ref,
    initialBlur: add_derivce_settings.video.blur,
  });
  const { blurValue: screenBlurValue, setVideoBlur: setScreenBlur } = useVideoBlur({
    videoRef: screen_track_ref,
    initialBlur: add_derivce_settings.screen.blur,
  });

  const [screen_enabled, set_screen_enabled] = useState(add_derivce_settings.screen.enabled);
  const trackReference = useEnsureTrackRef(trackRef);
  const layoutContext = useMaybeLayoutContext();
  const autoManageSubscription = useFeatureContext()?.autoSubscription;
  const handleSubscribe = useCallback(
    (subscribed: boolean) => {
      if (
        trackReference.source &&
        !subscribed &&
        layoutContext &&
        layoutContext.pin.dispatch &&
        isTrackReferencePinned(trackReference, layoutContext.pin.state)
      ) {
        layoutContext.pin.dispatch({ msg: 'clear_pin' });
      }
    },
    [trackReference, layoutContext],
  );

  // [toggle state] -----------------------------------------------------
  // - [audio] ----------------------------------------------------------
  const handleAudioStateChange = useCallback(async (enabled: boolean) => {
    console.log('接收到音频状态变化:', enabled);
    if (room) {
      set_audio_enabled(enabled);
      saveAudioInputEnabled(enabled);
      await enableAudioTrack(room, enabled);
    }
  }, []);
  // - [video] ----------------------------------------------------------
  const handleVideoStateChange = useCallback(async (enabled: boolean) => {
    console.log('接收到视频状态变化:', enabled);
    if (room) {
      set_video_enabled(enabled);
      saveVideoInputEnabled(enabled);
      await enableVideoTrack(room, enabled);
    }
  }, []);
  // - [screen] ---------------------------------------------------------
  const handleScreenStateChange = useCallback(async (enabled: boolean) => {
    console.log('接收到屏幕状态变化:', enabled);

    if (room) {
      set_screen_enabled(enabled);
      let state = await enableScreenTrack(room, enabled);
      // 发布事件
      publisher(SubjectKey.ScreenState, state);
    }
  }, []);

  const handleSettingChange = useCallback((param?: { data: AddDeviceInfo; identity: String }) => {
    console.log('接收到设置状态变化:');
    if (param && trackReference.participant.identity == param.identity) {
      if (param.data.video.blur != add_derivce_settings.video.blur) {
        add_derivce_settings.video.blur = param.data.video.blur;
        setVideoBlur(param.data.video.blur);
      }
      if (param.data.screen.blur != add_derivce_settings.screen.blur) {
        add_derivce_settings.screen.blur = param.data.screen.blur;
        setScreenBlur(param.data.screen.blur);
      }
    }
  }, []);

  useEffect(() => {
    const audio_subscription = subscriber(SubjectKey.Audio, handleAudioStateChange);
    const video_subscription = subscriber(SubjectKey.Video, handleVideoStateChange);
    const screen_subscription = subscriber(SubjectKey.Screen, handleScreenStateChange);
    const setting_subscription = subscriber(SubjectKey.Setting, handleSettingChange);
    return () => {
      audio_subscription?.unsubscribe();
      video_subscription?.unsubscribe();
      screen_subscription?.unsubscribe();
      setting_subscription?.unsubscribe();
    };
  }, [
    handleAudioStateChange,
    handleVideoStateChange,
    handleScreenStateChange,
    handleSettingChange,
  ]);

  // [focus] -------------------------------------------------------------
  const focus_on = () => {
    // 发布焦点事件
    publisher(SubjectKey.Focus, {
      track_ref: trackReference,
      video_blur: add_derivce_settings.video.blur,
    });
  };

  const wave_pin = () => {
    // 播放声音
    wave_audio_ref.current?.play();
  };

  // 监听状态变化
  useEffect(() => {
    console.log('audio_enabled 状态实际变化为:', audio_enabled);
  }, [audio_enabled]);
  // [status] ------------------------------------------------------------
  const [my_status, set_my_status] = useState<SvgType>('online_dot');
  const set_status_label = (): String => {
    switch (my_status) {
      case 'online_dot':
        return 'Online';
      case 'offline_dot':
        return 'Idle';
      case 'busy_dot':
        return 'Bussy, do not disturb';
      case 'away_dot':
        return 'Invisible';
      default:
        return 'Online';
    }
  };
  const status_menu: MenuProps['items'] = [
    {
      key: 'online_dot',
      label: (
        <div className={styles.status_item}>
          <SvgResource type="online_dot" svgSize={14}></SvgResource>
          <span>Online</span>
        </div>
      ),
    },
    {
      key: 'offline_dot',
      label: (
        <div className={styles.status_item}>
          <SvgResource type="offline_dot" svgSize={14}></SvgResource>
          <span>Idle</span>
        </div>
      ),
    },
    {
      key: 'busy_dot',
      label: (
        <div className={styles.status_item}>
          <SvgResource type="busy_dot" svgSize={14}></SvgResource>
          <span>Bussy, do not disturb</span>
          <div>You will not receive any notifications.</div>
        </div>
      ),
    },
    {
      key: 'away_dot',
      label: (
        <div className={styles.status_item}>
          <SvgResource type="away_dot" svgSize={14}></SvgResource>
          <span>Invisible</span>
          <div>You will not appear online, but you can use all Vocespace features.</div>
        </div>
      ),
    },
  ];

  const to_rename_user = () => {
    open_settings();
  };

  const user_menu: MenuProps['items'] = [
    {
      key: 'user_info',
      label: (
        <div className={styles.user_info_wrap} onClick={to_rename_user}>
          <div className={styles.user_info_wrap_name}>{trackReference.participant.name}</div>
          <SvgResource type="modify" svgSize={14} color="#fff"></SvgResource>
          {/* <div className={styles.user_info_wrap_identity}>{trackReference.participant.identity}</div> */}
        </div>
      ),
    },
    {
      key: 'user_status',
      label: (
        <Dropdown
          placement="topLeft"
          menu={{
            items: status_menu,
            onClick: (e) => set_my_status(e.key as SvgType),
          }}
        >
          <div className={styles.status_item_inline} style={{ width: '100%' }}>
            <div className={styles.status_item_inline}>
              <SvgResource type={my_status} svgSize={14}></SvgResource>
              <div>{set_status_label()}</div>
            </div>
            <SvgResource type="right" svgSize={14} color="#fff"></SvgResource>
          </div>
        </Dropdown>
      ),
    },
  ];

  return (
    <ParticipantTile {...htmlProps} className={styles.tile} ref={ref}>
      {isTrackReference(trackReference) &&
        trackReference.source == Track.Source.Camera &&
        video_enabled &&
        !virtual && (
          <VideoTrack
            ref={video_track_ref}
            trackRef={trackReference}
            style={{
              filter: `blur(${blurValue}px)`,
            }}
          ></VideoTrack>
        )}
      {isTrackReference(trackReference) &&
        trackReference.source == Track.Source.Camera &&
        video_enabled &&
        virtual && (
          <div style={{ height: '100%', width: '100%' }}>
            <VirtualRoleCanvas></VirtualRoleCanvas>
          </div>
        )}
      {isTrackReference(trackReference) &&
        trackReference.source == Track.Source.ScreenShare &&
        screen_enabled && (
          <VideoTrack
            ref={screen_track_ref}
            trackRef={trackReference}
            style={{
              filter: `blur(${screenBlurValue}px)`,
            }}
          ></VideoTrack>
        )}
      {/* className="lk-participant-placeholder"  */}
      <div className="lk-participant-placeholder">
        <ParticipantPlaceholder />
      </div>
      <div className="lk-participant-metadata">
        <Dropdown
          placement="topLeft"
          trigger={['click']}
          menu={{
            items: user_menu,
          }}
          disabled={trackReference.participant.identity != room?.localParticipant.identity}
        >
          <div className="lk-participant-metadata-item">
            {trackReference.source === Track.Source.Camera ? (
              <>
                {isEncrypted && <LockLockedIcon style={{ marginRight: '0.25rem' }} />}
                <TrackMutedIndicator
                  trackRef={{
                    participant: trackReference.participant,
                    source: Track.Source.Microphone,
                  }}
                  show={'muted'}
                ></TrackMutedIndicator>
                <ParticipantName />
              </>
            ) : (
              <>
                <ScreenShareIcon style={{ marginRight: '0.25rem' }} />
                <ParticipantName>&apos;s screen</ParticipantName>
              </>
            )}
            <div className={styles.status_wrap}>
              <div className={styles.status_item}>
                <SvgResource type={my_status} svgSize={14}></SvgResource>
              </div>
            </div>
          </div>
        </Dropdown>

        <ConnectionQualityIndicator className="lk-participant-metadata-item" />
      </div>
      <LayoutContext.Consumer>
        {(layoutContext) =>
          layoutContext !== undefined && (
            <button
              className="lk-button lk-focus-toggle-button"
              style={{
                left: '0.25rem',
                width: 'fit-content',
              }}
              onClick={wave_pin}
            >
              <SvgResource svgSize={16} type="wave"></SvgResource>
            </button>
          )
        }
      </LayoutContext.Consumer>
      <audio
        ref={wave_audio_ref}
        style={{ display: 'none' }}
        src={`${process.env.NEXT_PUBLIC_BASE_PATH}/audios/vocespacewave.m4a`}
      ></audio>
    </ParticipantTile>
  );
}
/**
 * Check if the `TrackReference` is pinned.
 */
export function isTrackReferencePinned(
  trackReference: TrackReferenceOrPlaceholder,
  pinState: PinState | undefined,
): boolean {
  if (typeof pinState === 'undefined') {
    return false;
  }
  if (isTrackReference(trackReference)) {
    return pinState.some(
      (pinnedTrackReference) =>
        pinnedTrackReference.participant.identity === trackReference.participant.identity &&
        isTrackReference(pinnedTrackReference) &&
        pinnedTrackReference.publication.trackSid === trackReference.publication.trackSid,
    );
  } else if (isTrackReferencePlaceholder(trackReference)) {
    return pinState.some(
      (pinnedTrackReference) =>
        pinnedTrackReference.participant.identity === trackReference.participant.identity &&
        isTrackReferencePlaceholder(pinnedTrackReference) &&
        pinnedTrackReference.source === trackReference.source,
    );
  } else {
    return false;
  }
}

/**
 * 启用/禁用音频轨道
 * @param room 当前房间实例
 * @param enabled 是否启用
 * @returns 状态枚举
 */
async function enableAudioTrack(room: Room, enabled: boolean): Promise<State> {
  if (room.state === ConnectionState.Connected) {
    const audioTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);

    if (audioTrack) {
      // 已有音频轨道
      if (enabled) {
        const res = await audioTrack.unmute();
        return res ? State.Start : State.Stop;
      } else {
        audioTrack.mute();
        return State.Stop;
      }
    } else {
      // 没有音频轨道时，创建新轨道
      if (room.localParticipant.connectionQuality !== ConnectionQuality.Unknown && enabled) {
        const res = await room.localParticipant.setMicrophoneEnabled(enabled);
        return res ? State.Start : State.Stop;
      }
      return State.Stop;
    }
  } else {
    return State.Stop;
  }
}

/**
 * 启用/禁用视频轨道
 * @param room 当前房间实例
 * @param enabled 是否启用
 * @returns 状态枚举
 */
async function enableVideoTrack(room: Room, enabled: boolean): Promise<State> {
  if (room.state === ConnectionState.Connected) {
    const videoTrack = room.localParticipant.getTrackPublication(Track.Source.Camera);

    if (videoTrack) {
      // 已有视频轨道
      if (enabled) {
        const res = await videoTrack.unmute();
        return res ? State.Start : State.Stop;
      } else {
        videoTrack.mute();
        return State.Stop;
      }
    } else {
      // 没有视频轨道时，创建新轨道
      if (room.localParticipant.connectionQuality !== ConnectionQuality.Unknown && enabled) {
        const res = await room.localParticipant.setCameraEnabled(enabled);
        return res ? State.Start : State.Stop;
      }
      return State.Stop;
    }
  } else {
    return State.Stop;
  }
}

/**
 * 启用/禁用屏幕共享轨道
 * @param room 当前房间实例
 * @param enabled 是否启用
 * @returns 状态枚举
 */
async function enableScreenTrack(room: Room, enabled: boolean): Promise<State> {
  try {
    if (room.state === ConnectionState.Connected) {
      const screenTrack = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);

      if (screenTrack) {
        // 已有屏幕共享轨道
        if (enabled) {
          const res = await screenTrack.unmute();
          return res ? State.Start : State.Stop;
        } else {
          if (screenTrack.track) {
            // 停止轨道并取消发布
            screenTrack.track.stop();
            await room.localParticipant.unpublishTrack(screenTrack.track);
          }
          return State.Stop;
        }
      } else {
        // 没有屏幕共享轨道时，创建新轨道
        if (room.localParticipant.connectionQuality !== ConnectionQuality.Unknown && enabled) {
          const res = await room.localParticipant.setScreenShareEnabled(enabled);
          return res ? State.Start : State.Stop;
        }
        return State.Stop;
      }
    } else {
      return State.Stop;
    }
  } catch (e) {
    console.error('屏幕共享控制异常:', e);
    return State.Stop;
  }
}
