import {
  DisconnectButton,
  LeaveIcon,
  usePersistentUserChoices,
  VideoConference,
  RoomContext,
  RoomName,
  ControlBarControls,
  useLocalParticipantPermissions,
  ChatToggle,
  ChatIcon,
  useLocalParticipant,
} from '@livekit/components-react';
import styles from '@/styles/controls.module.scss';
import { AudioToggle } from './controls/audio_toggle';
import { VideoToggle } from './controls/video_toggle';
import { ScreenToggle } from './controls/screen_toggle';
import { ConnectionState, Room, Track } from 'livekit-client';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { publisher, subject_map, SubjectKey, subscriber } from '@/lib/std/chanel';
import { SettingToggle } from './controls/setting_toggle';
import { Button, Drawer, message, Modal, Slider, Tabs } from 'antd';
import { SvgResource } from '../pre_join/resources';
import { use_add_user_device, use_stored_set } from '@/lib/hooks/store/user_choices';
import { AddDeviceInfo, State, useVideoBlur } from '@/lib/std/device';
import { Settings } from './controls/settings';

export function Controls({
  room,
  saveUserChoices = true,
  controls,
}: {
  room?: Room;
  saveUserChoices?: boolean;
  controls?: ControlBarControls;
}) {
  // [hooks] -----------------------------------------------------------------
  const {
    userChoices,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: !saveUserChoices });
  const { localParticipant } = useLocalParticipant();
  const add_derivce_settings = use_add_user_device(userChoices.username);
  const video_track_ref = useRef<HTMLImageElement>(null);
  // [states] -----------------------------------------------------------------
  const [messageApi, contextHolder] = message.useMessage();
  const [audio_enabled, set_audio_enabled] = useState(userChoices.audioEnabled);
  const [video_enabled, set_video_enabled] = useState(userChoices.videoEnabled);
  const [screen_enabled, set_screen_enabled] = useState(add_derivce_settings.screen.enabled);
  const [setting_visible, set_setting_visible] = useState(false);
  const [volume, set_volume] = useState(add_derivce_settings.microphone.other);
  const [video_blur, set_video_blur] = useState(add_derivce_settings.video.blur);
  const [screen_blur, set_screen_blur] = useState(add_derivce_settings.screen.blur);
  const [screen_bg_color, set_screen_bg_color] = useState(screen_enabled ? '#1E1E1E' : '#22CCEE');
  const [record, set_record] = useState(add_derivce_settings);
  const [saved, set_saved] = useState(false);
  const visibleControls = { leave: true, ...controls };
  const localPermissions = useLocalParticipantPermissions();

  if (!localPermissions) {
    visibleControls.camera = false;
    visibleControls.chat = false;
    visibleControls.microphone = false;
    visibleControls.screenShare = false;
  } else {
    visibleControls.camera ??= localPermissions.canPublish;
    visibleControls.microphone ??= localPermissions.canPublish;
    visibleControls.screenShare ??= localPermissions.canPublish;
    visibleControls.chat ??= localPermissions.canPublishData && controls?.chat;
  }

  const { blurValue, setVideoBlur } = useVideoBlur({
    videoRef: video_track_ref,
    initialBlur: add_derivce_settings.video.blur,
  });

  // [toggle click handlers] -------------------------------------------------
  // - [audio] ---------------------------------------------------------------
  const audio_on_clicked = useCallback(
    (enabled: boolean): void => {
      if (room && room.state === ConnectionState.Connected) {
        const new_state = !enabled;
        set_audio_enabled(new_state);
        saveAudioInputEnabled(new_state);
        new_state && saveAudioInputDeviceId(userChoices.audioDeviceId);
        // 发布事件
        publisher(SubjectKey.Audio, new_state);
      }
    },
    [saveAudioInputEnabled, saveAudioInputDeviceId],
  );
  // - [video] ---------------------------------------------------------------
  const video_on_clicked = useCallback(
    (enabled: boolean): void => {
      if (room && room.state === ConnectionState.Connected) {
        const new_state = !enabled;
        set_video_enabled(new_state);
        saveVideoInputEnabled(new_state);
        new_state && saveVideoInputDeviceId(userChoices.videoDeviceId);
        // 发布事件
        publisher(SubjectKey.Video, new_state);
      }
    },
    [saveVideoInputEnabled, saveVideoInputDeviceId],
  );
  // - [screen] --------------------------------------------------------------
  const screen_on_clicked = useCallback(
    (enabled: boolean): void => {
      if (room && room.state === ConnectionState.Connected) {
        const new_state = !enabled;
        set_screen_enabled(new_state);
        add_derivce_settings.screen.enabled = new_state;
        // 发布事件
        publisher(SubjectKey.Screen, new_state);
      }
    },
    [saveVideoInputEnabled],
  );

  // - [setting] -------------------------------------------------------------
  const setting_on_clicked = useCallback(
    (visible: boolean): void => {
      const new_state = !visible;
      set_setting_visible(new_state);
    },
    [saveAudioInputEnabled],
  );

  const save_changes = (save: boolean) => {
    let username = userChoices.username;
    let data = Object.assign(add_derivce_settings, {
      microphone: {
        other: volume,
      },
      video: {
        blur: video_blur,
      },
      screen: {
        blur: screen_blur,
      },
    }) as AddDeviceInfo;
    use_stored_set(username, { device: data });

    // 发布事件
    publisher(SubjectKey.Setting, {
      data,
      identity: localParticipant.identity,
    });
    set_saved(save);
    if (save) {
      set_setting_visible(false);
      set_record(data);
      messageApi.success('Changes saved successfully');
    }
  };

  const close_setting = () => {
    // 当saved为false时 ,将record重新赋值给add_derivce_settings
    if (!saved) {
      set_volume(record.microphone.other);
      set_video_blur(record.video.blur);
      set_screen_blur(record.screen.blur);
      let username = userChoices.username;
      use_stored_set(username, { device: record });
    }
  };

  const screen_handle_state = useCallback((state: State) => {
    if (state === State.Start) {
      set_screen_enabled(true);
      set_screen_bg_color('#22CCEE');
    } else {
      set_screen_enabled(false);

      set_screen_bg_color('#1E1E1E');
    }
  }, []);

  // const audio_handle_state = useCallback((state: State) => {
  //   console.error('audio_handle_state', state);
  //   set_audio_enabled(state === State.Start);
  // }, []);

  // const video_handle_state = useCallback((state: State) => {
  //   set_video_enabled(state === State.Start);
  // }, []);

  useEffect(() => {
    const screen_sub = subscriber(SubjectKey.ScreenState, screen_handle_state);
    // const audio_sub = subscriber(SubjectKey.AudioState, audio_handle_state);
    // const video_sub = subscriber(SubjectKey.VideoState, video_handle_state);

    return () => {
      screen_sub?.unsubscribe();
      // audio_sub?.unsubscribe();
      // video_sub?.unsubscribe();
    };
  }, [screen_handle_state]);

  // [当整个room加载好之后，询问用户是否需要开启屏幕分享] -------------------------------------------------------------------
  const { confirm } = Modal;

  useEffect(() => {
    if (room?.state === ConnectionState.Connected) {
      confirm({
        title: 'Do you want to share your screen?',
        content: 'You can share your screen with others in the room.',
        onOk() {
          screen_on_clicked(false);
        },
        onCancel() {},
      });
    }
  }, [room?.state]);

  return (
    <div className={`${styles.controls} lk-control-bar`}>
      {contextHolder}
      <div className={styles.controls_left}>
        <AudioToggle enabled={audio_enabled} onClicked={audio_on_clicked}></AudioToggle>
        <VideoToggle enabled={video_enabled} onClicked={video_on_clicked}></VideoToggle>
        <ScreenToggle
          enabled={screen_enabled}
          onClicked={screen_on_clicked}
          bg_color={screen_bg_color}
        ></ScreenToggle>
        <SettingToggle enabled={setting_visible} onClicked={setting_on_clicked}></SettingToggle>
        {visibleControls.chat && (
          <ChatToggle>
            <ChatIcon /> Chat
          </ChatToggle>
        )}
      </div>
      <div className={styles.controls_right}>
        <DisconnectButton>
          <LeaveIcon />
        </DisconnectButton>
      </div>
      <Drawer
        style={{ backgroundColor: '#1e1e1e', padding: 0, margin: 0 }}
        title="Settings"
        placement="right"
        closable={false}
        onClose={close_setting}
        width={'640px'}
        open={setting_visible}
        extra={setting_drawer_header({
          on_clicked: () => set_setting_visible(false),
        })}
      >
        <div className={styles.setting_container}>
          <Settings
            messageApi={messageApi}
            microphone={{
              audio: {
                volume: volume,
                set_volume: set_volume,
              },
            }}
            camera={{
              video: {
                blur: video_blur,
                set_video_blur: set_video_blur,
              },
              screen: {
                blur: screen_blur,
                set_screen_blur: set_screen_blur,
              },
              set_blur: setVideoBlur,
            }}
            save_changes={save_changes}
          ></Settings>
          <div className={styles.setting_container_footer}>
            <Button type="primary" onClick={() => save_changes(true)}>
              Save Changes
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

const setting_drawer_header = ({ on_clicked }: { on_clicked: () => void }): ReactNode => {
  return (
    <div>
      <Button type="text" shape="circle" onClick={on_clicked}>
        <SvgResource type="close" color="#fff" svgSize={16}></SvgResource>
      </Button>
    </div>
  );
};
