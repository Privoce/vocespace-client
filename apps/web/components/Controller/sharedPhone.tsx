'use client';
import { useState } from 'react';
import { socket } from '@/lib/realtime/socket';
import { audio } from '@/lib/audio';
import { PhoneSheet } from '@/components/MeetingUI/PhoneSheet';
import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Popover } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { MeetingControls, MeetingMenu, type MeetingAction } from '@vocespace/ui';
import { MeetingButton as Button, MeetingIcon as Icon } from '@/components/MeetingUI/primitives';
import { DevicesSelector } from '@/app/api/devices/device_selector';
import { MediaDeviceKind } from '@/lib/std/device';
import { markExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import { MoreButton } from '@/components/Toggles/MoreButton';
import { ControlsWork, type ControlsModel } from './phone';
function useSharedControls(model: ControlsModel, onMore: () => void) {
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
  if (space) actions.push({ id: 'more', icon: 'more', label: t('more.title'), onPress: onMore });
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
  const [moreOpen, setMoreOpen] = useState(false);
  const actions = useSharedControls(model, () => setMoreOpen(true));
  const { t, space } = model;
  return (
    <div
      {...model.htmlProps}
      style={{ width: '100%', position: 'relative' }}
      ref={model.controlLeftRef}
    >
      <MeetingControls Button={Button} Icon={Icon} actions={actions} />
      <ControlsWork model={model} />
      {space && (
        <PhoneSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title={t('phone_meeting.more_title')}
          subtitle={t('phone_meeting.more_subtitle')}
          closeLabel={t('common.close')}
          height="78%"
        >
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
            renderMenu={(items, select) => (
              <MeetingMenu
                Button={Button}
                Icon={Icon}
                footer={t('phone_meeting.media_hint')}
                actions={[
                  {
                    id: 'hand',
                    icon: 'hand',
                    label: t('phone_meeting.hand'),
                    description: t('phone_meeting.hand_hint'),
                    onPress: async () => {
                      setMoreOpen(false);
                      await model.updateSettings({ raiseHand: true });
                      socket.emit('update_user_status', { space: space.name });
                      socket.emit('raise', {
                        space: space.name,
                        senderId: space.localParticipant.identity,
                        senderName: space.localParticipant.name,
                        senderSocketId:
                          model.spaceInfo.participants[space.localParticipant.identity]?.socketId,
                      });
                      void audio.raise();
                    },
                  },
                  {
                    id: 'share',
                    icon: 'link',
                    label: t('phone_meeting.share'),
                    description: t('phone_meeting.share_hint'),
                    onPress: () => {
                      setMoreOpen(false);
                      model.setOpenShareModal(true);
                    },
                  },
                  ...items
                    .filter((item): item is Exclude<typeof item, null> => !!item)
                    .map((item) => {
                      const id = String(item.key);
                      const labels: Record<string, string> = {
                        app: t('more.app.title'),
                        participant: t('phone_meeting.members'),
                        setting: t('common.setting'),
                        record: t(model.isRecording ? 'more.record.stop' : 'more.record.start'),
                        platform_user: t('more.platform'),
                      };
                      return {
                        id,
                        icon: (id === 'setting'
                          ? 'settings'
                          : id === 'participant'
                            ? 'members'
                            : id === 'record'
                              ? 'camera'
                              : 'app') as MeetingAction['icon'],
                        label: labels[id] || id,
                        description:
                          id === 'app'
                            ? t('phone_meeting.apps_hint')
                            : id === 'setting'
                              ? t('phone_meeting.settings_hint')
                              : undefined,
                        onPress: () => {
                          setMoreOpen(false);
                          select(id);
                        },
                      };
                    }),
                ]}
              />
            )}
          />
        </PhoneSheet>
      )}
    </div>
  );
}
