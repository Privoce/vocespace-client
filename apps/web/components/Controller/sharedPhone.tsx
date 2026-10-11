'use client';
import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Popover } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { MeetingControls, type MeetingAction } from '@vocespace/ui';
import { MeetingButton as Button, MeetingIcon as Icon } from '@/components/MeetingUI/primitives';
import { DevicesSelector } from '@/app/api/devices/device_selector';
import { MediaDeviceKind } from '@/lib/std/device';
import { markExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import { MoreButton } from '@/components/Toggles/MoreButton';
import { ControlsWork, type ControlsModel } from './phone';
import styles from './index.module.scss';
function useSharedControls(model: ControlsModel) {
  const { t, visibleControls, space } = model;
  const mic = useTrackToggle({
    source: Track.Source.Microphone,
    onChange: model.microphoneOnChange,
    onDeviceError: (error) => {
      model.setPermissionDevice(Track.Source.Microphone);
      model.onDeviceError?.({ source: Track.Source.Microphone, error });
    },
  });
  const camera = useTrackToggle({
    source: Track.Source.Camera,
    onChange: model.cameraOnChange,
    onDeviceError: (error) => {
      model.setPermissionDevice(Track.Source.Camera);
      model.onDeviceError?.({ source: Track.Source.Camera, error });
    },
  });
  const screen = useTrackToggle({
    source: Track.Source.ScreenShare,
    onChange: model.onScreenShareChange,
    captureOptions: { audio: model.uState.openShareAudio, selfBrowserSurface: 'include' },
    onDeviceError: (error) => {
      model.setPermissionDevice(Track.Source.ScreenShare);
      model.onDeviceError?.({ source: Track.Source.ScreenShare, error });
    },
  });
  const actions: MeetingAction[] = (['microphone', 'camera'] as const).map((device) => {
    const isCamera = device === 'camera';
    const toggle = isCamera ? camera : mic;
    const open = isCamera ? model.videoMenuOpen : model.audioMenuOpen;
    const setOpen = isCamera ? model.setVideoMenuOpen : model.setAudioMenuOpen;
    const source = isCamera ? Track.Source.Camera : Track.Source.Microphone;
    const label = t(isCamera ? 'common.device.camera' : 'common.device.microphone');
    return {
      id: device,
      icon: device,
      label,
      disabled: !visibleControls[device] || toggle.pending,
      active: toggle.enabled,
      muted: !toggle.enabled,
      onPress: () => {
        // Calling toggle directly doesn't set LiveKit's DOM-click flag. Persist only
        // the successful user action, never mount/reconnect/remote permission updates.
        void toggle
          .toggle()
          .then((enabled) => {
            if (typeof enabled === 'boolean') {
              (isCamera ? model.cameraOnChange : model.microphoneOnChange)(enabled, true);
            }
          })
          .catch(() => undefined);
      },
      menu: visibleControls[device] && (
        <Popover
          trigger="click"
          open={open}
          onOpenChange={setOpen}
          placement="top"
          content={
            <DevicesSelector
              enabled={open}
              kind={isCamera ? MediaDeviceKind.VideoInput : MediaDeviceKind.AudioInput}
              preferredDeviceId={
                isCamera ? model.userChoices.videoDeviceId : model.userChoices.audioDeviceId
              }
              requestPermissions
              err={(error) => {
                model.setPermissionDevice(source);
                model.onDeviceError?.({ source, error });
              }}
              onDeviceChanged={(id) => {
                (isCamera ? model.saveVideoInputDeviceId : model.saveAudioInputDeviceId)(
                  id ?? 'default',
                );
                setOpen(false);
              }}
            />
          }
        >
          <button
            aria-label={label}
            type="button"
            style={{
              width: 20,
              height: 20,
              padding: 0,
              borderRadius: '50%',
              background: '#29323E',
              color: '#C6D1E2',
              border: 0,
            }}
          >
            <DownOutlined />
          </button>
        </Popover>
      ),
    };
  });
  actions.push({
    id: 'screen',
    icon: 'screen',
    label: t('common.share_screen'),
    disabled: !visibleControls.screenShare || !model.browserSupportsScreenSharing || screen.pending,
    active: screen.enabled,
    onPress: () => {
      void screen.toggle().catch(() => undefined);
    },
  });
  if (visibleControls.chat)
    actions.push({
      id: 'chat',
      icon: 'chat',
      label: t('common.chat'),
      badge: model.chatMsg.unhandled,
      active: model.chatOpen,
      onPress: () => model.setChatOpen(!model.chatOpen),
    });
  if (space)
    actions.push({
      id: 'more',
      icon: 'more',
      label: t('more.title'),
      onPress: () => {},
      content: (
        <div className={styles.action}>
          <MoreButton
            space={space}
            spaceInfo={model.spaceInfo}
            config={model.config}
            size="small"
            controlWidth={model.controlWidth}
            setOpenMore={model.setOpenMore}
            setMoreType={model.setMoreType}
            onSettingOpen={async () => model.setSettingVis(true)}
            onClickAI={model.onClickAI}
            onClickRecord={model.onClickRecord}
            onClickManage={model.fetchSettings}
            onClickApp={model.onClickApp}
            isRecording={model.isRecording}
          />
        </div>
      ),
    });
  if (visibleControls.leave)
    actions.push({
      id: 'leave',
      icon: 'leave',
      label: t('common.leave'),
      danger: true,
      onPress: () => {
        markExplicitLeaveIntent();
        void space?.disconnect();
      },
    });
  return actions;
}
export function ControlsShared({ model }: { model: ControlsModel }) {
  const actions = useSharedControls(model);
  return (
    <div
      {...model.htmlProps}
      style={{ width: '100%', position: 'relative' }}
      ref={model.controlLeftRef}
    >
      <MeetingControls Button={Button} Icon={Icon} actions={actions} />
      <ControlsWork model={model} />
    </div>
  );
}
