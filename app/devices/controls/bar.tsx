import { useI18n } from '@/lib/i18n/i18n';
import {
  ChatIcon,
  ChatToggle,
  DisconnectButton,
  GearIcon,
  LeaveIcon,
  MediaDeviceMenu,
  StartMediaButton,
  TrackToggle,
  useLocalParticipantPermissions,
  useMaybeLayoutContext,
  useMaybeRoomContext,
  useMediaDeviceSelect,
  usePersistentUserChoices,
  useTracks,
} from '@livekit/components-react';
import { Button, Drawer, message } from 'antd';
import { LocalAudioTrack, RoomEvent, Track } from 'livekit-client';
import * as React from 'react';
// import { Settings } from './settings';
import { SettingToggle } from './setting_toggle';
import { SvgResource } from '@/app/resources/svg';
import styles from '@/styles/controls.module.scss';
import { Settings, SettingsExports, TabKey } from './settings';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import { useRecoilState } from 'recoil';
import { deviceState } from '@/app/rooms/[roomName]/PageClientImpl';
import { MediaDeviceKind } from '@/lib/std/device';

/** @public */
export type ControlBarControls = {
  microphone?: boolean;
  camera?: boolean;
  chat?: boolean;
  screenShare?: boolean;
  leave?: boolean;
  settings?: boolean;
};

/** @public */
export interface ControlBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
  variation?: 'minimal' | 'verbose' | 'textOnly';
  controls?: ControlBarControls;
  /**
   * If `true`, the user's device choices will be persisted.
   * This will enable the user to have the same device choices when they rejoin the room.
   * @defaultValue true
   * @alpha
   */
  saveUserChoices?: boolean;
}

/**
 * The `ControlBar` prefab gives the user the basic user interface to control their
 * media devices (camera, microphone and screen share), open the `Chat` and leave the room.
 *
 * @remarks
 * This component is build with other LiveKit components like `TrackToggle`,
 * `DeviceSelectorButton`, `DisconnectButton` and `StartAudio`.
 *
 * @example
 * ```tsx
 * <LiveKitRoom>
 *   <ControlBar />
 * </LiveKitRoom>
 * ```
 * @public
 */
export function Controls({
  variation,
  controls,
  saveUserChoices = true,
  onDeviceError,
  ...props
}: ControlBarProps) {
  const { t } = useI18n();
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [settingVis, setSettingVis] = React.useState(false);
  const layoutContext = useMaybeLayoutContext();

  React.useEffect(() => {
    if (layoutContext?.widget.state?.showChat !== undefined) {
      setIsChatOpen(layoutContext?.widget.state?.showChat);
    }
  }, [layoutContext?.widget.state?.showChat]);
  const isTooLittleSpace = useMediaQuery(`(max-width: ${isChatOpen ? 1000 : 760}px)`);

  const defaultVariation = isTooLittleSpace ? 'minimal' : 'verbose';
  variation ??= defaultVariation;

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

  const showIcon = React.useMemo(
    () => variation === 'minimal' || variation === 'verbose',
    [variation],
  );
  const showText = React.useMemo(
    () => variation === 'textOnly' || variation === 'verbose',
    [variation],
  );

  const browserSupportsScreenSharing = supportsScreenSharing();

  const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(false);

  const onScreenShareChange = React.useCallback(
    (enabled: boolean) => {
      setIsScreenShareEnabled(enabled);
    },
    [setIsScreenShareEnabled],
  );

  const htmlProps = { className: 'lk-control-bar', ...props };

  const {
    userChoices,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
    saveUsername,
  } = usePersistentUserChoices({ preventSave: !saveUserChoices });

  const microphoneOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveAudioInputEnabled(enabled) : null,
    [saveAudioInputEnabled],
  );

  const cameraOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) =>
      isUserInitiated ? saveVideoInputEnabled(enabled) : null,
    [saveVideoInputEnabled],
  );

  // settings ------------------------------------------------------------------------------------------
  const room = useMaybeRoomContext();

  const [key, set_key] = React.useState<TabKey>('general');
  const [virtualEnabled, setVirtualEnabled] = React.useState(false);
  const [modelRole, setModelRole] = React.useState<ModelRole>(ModelRole.Haru);
  const [modelBg, setModelBg] = React.useState<ModelBg>(ModelBg.ClassRoom);
  const settingsRef = React.useRef<SettingsExports>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [device, setDevice] = useRecoilState(deviceState);
  const [volume, setVolume] = React.useState(device.volme);
  const [videoBlur, setVideoBlur] = React.useState(device.blur);
  const [screenBlur, setScreenBlur] = React.useState(device.screenBlur);
  const closeSetting = () => {
    // 当saved为false时 ,将record重新赋值给add_derivce_settings
    // if (!saved) {
    //   set_volume(record.microphone.other);
    //   set_video_blur(record.video.blur);
    //   set_screen_blur(record.screen.blur);
    //   let username = userChoices.username;
    //   use_stored_set(username, { device: record });
    // }
  };

  const saveChanges = async (save: boolean, key: TabKey) => {
    switch (key) {
      case 'general': {
        const new_name = settingsRef.current?.username;
        if (new_name) {
          // rename_user_and_store(username, new_name);
          saveUsername(new_name);
          // await localParticipant.setName(settings_ref.current?.username);
          if (room) {
            try {
              await room.localParticipant?.setMetadata(JSON.stringify({ name: new_name }));
              await room.localParticipant.setName(new_name);
              messageApi.success(t('msg.success.user.username.change'));
            } catch (error) {
              messageApi.error(t('msg.error.user.username.change'));
            }
          }
        }
        break;
      }
    }
  };

  return (
    <div {...htmlProps}>
      {contextHolder}
      {visibleControls.microphone && (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={showIcon}
            onChange={microphoneOnChange}
            onDeviceError={(error) => onDeviceError?.({ source: Track.Source.Microphone, error })}
          >
            {showText && t('common.device.microphone')}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="audioinput"
              onActiveDeviceChange={(_kind, deviceId) =>
                saveAudioInputDeviceId(deviceId ?? 'default')
              }
            />
          </div>
        </div>
      )}
      {visibleControls.camera && (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Camera}
            showIcon={showIcon}
            onChange={cameraOnChange}
            onDeviceError={(error) => onDeviceError?.({ source: Track.Source.Camera, error })}
          >
            {showText && t('common.device.camera')}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="videoinput"
              onActiveDeviceChange={(_kind, deviceId) =>
                saveVideoInputDeviceId(deviceId ?? 'default')
              }
            />
          </div>
        </div>
      )}
      {visibleControls.screenShare && browserSupportsScreenSharing && (
        <TrackToggle
          source={Track.Source.ScreenShare}
          captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
          showIcon={showIcon}
          onChange={onScreenShareChange}
          onDeviceError={(error) => onDeviceError?.({ source: Track.Source.ScreenShare, error })}
        >
          {showText && (isScreenShareEnabled ? t('common.stop_share') : t('common.share_screen'))}
        </TrackToggle>
      )}
      {visibleControls.chat && (
        <ChatToggle>
          {showIcon && <ChatIcon />}
          {showText && t('common.chat')}
        </ChatToggle>
      )}
      <SettingToggle
        enabled={settingVis}
        onClicked={() => {
          setSettingVis(true);
        }}
      ></SettingToggle>
      {visibleControls.leave && (
        <DisconnectButton>
          {showIcon && <LeaveIcon />}
          {showText && t('common.leave')}
        </DisconnectButton>
      )}
      <StartMediaButton />
      <Drawer
        style={{ backgroundColor: '#1e1e1e', padding: 0, margin: 0, color: '#fff' }}
        title={t('common.setting')}
        placement="right"
        closable={false}
        onClose={closeSetting}
        width={'640px'}
        open={settingVis}
        extra={setting_drawer_header({
          on_clicked: () => setSettingVis(false),
        })}
      >
        <div className={styles.setting_container}>
          <Settings
            virtual={{
              enabled: virtualEnabled,
              setEnabled: setVirtualEnabled,
              modelRole: modelRole,
              setModelRole: setModelRole,
              modelBg: modelBg,
              setModelBg: setModelBg,
            }}
            ref={settingsRef}
            messageApi={messageApi}
            microphone={{
              audio: {
                volume: volume,
                setVolume,
              },
            }}
            camera={{
              video: {
                blur: videoBlur,
                setVideoBlur,
              },
              screen: {
                blur: screenBlur,
                setScreenBlur,
              },
            }}
            username={userChoices.username}
            tab_key={{ key, set_key }}
            saveChanges={saveChanges}
          ></Settings>
        </div>
      </Drawer>
    </div>
  );
}

export function useMediaQuery(query: string): boolean {
  const getMatches = (query: string): boolean => {
    // Prevents SSR issues
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const [matches, setMatches] = React.useState<boolean>(getMatches(query));

  function handleChange() {
    setMatches(getMatches(query));
  }

  React.useEffect(() => {
    const matchMedia = window.matchMedia(query);

    // Triggered at the first client-side load and if query changes
    handleChange();

    // Listen matchMedia
    if (matchMedia.addListener) {
      matchMedia.addListener(handleChange);
    } else {
      matchMedia.addEventListener('change', handleChange);
    }

    return () => {
      if (matchMedia.removeListener) {
        matchMedia.removeListener(handleChange);
      } else {
        matchMedia.removeEventListener('change', handleChange);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return matches;
}

export function supportsScreenSharing(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    !!navigator.mediaDevices.getDisplayMedia
  );
}

const setting_drawer_header = ({ on_clicked }: { on_clicked: () => void }): React.ReactNode => {
  return (
    <div>
      <Button type="text" shape="circle" onClick={on_clicked}>
        <SvgResource type="close" color="#fff" svgSize={16}></SvgResource>
      </Button>
    </div>
  );
};
