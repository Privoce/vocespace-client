import { useI18n } from '@/lib/i18n/i18n';
import {
  DisconnectButton,
  LeaveIcon,
  MediaDeviceMenu,
  TrackToggle,
  useLocalParticipantPermissions,
  useMaybeLayoutContext,
  useMaybeRoomContext,
  usePersistentUserChoices,
} from '@livekit/components-react';
import { Drawer, Input, message, Modal } from 'antd';
import { Participant, Track } from 'livekit-client';
import * as React from 'react';
import styles from '@/styles/controls.module.scss';
import { Settings, SettingsExports, TabKey } from './settings';
import { useRecoilState } from 'recoil';
import { chatMsgState, socket, userState, virtualMaskState } from '@/app/[roomName]/PageClientImpl';
import { ParticipantSettings, RoomSettings } from '@/lib/std/room';
import { connect_endpoint, UserStatus } from '@/lib/std';
import { EnhancedChat, EnhancedChatExports } from '@/app/pages/chat/chat';
import { ChatToggle } from './chat_toggle';
import { MoreButton } from './more_button';
import { ControlType, WsControlParticipant, WsTo } from '@/lib/std/device';
import { DEFAULT_DRAWER_PROP, DrawerCloser } from './drawer_tools';
import { AppDrawer } from '../apps/app_drawer';
import { ParticipantManage } from '../participant/manage';

const RECORD_URL = connect_endpoint('/api/record');

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
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  roomSettings: RoomSettings;
  fetchSettings: () => Promise<void>;
  updateRecord: (active: boolean, egressId?: string, filePath?: string) => Promise<boolean>;
  setPermissionDevice: (device: Track.Source) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
}

export interface ControlBarExport {
  openSettings: (key: TabKey) => void;
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
export const Controls = React.forwardRef<ControlBarExport, ControlBarProps>(
  (
    {
      variation,
      controls,
      saveUserChoices = true,
      onDeviceError,
      updateSettings,
      setUserStatus,
      roomSettings,
      fetchSettings,
      updateRecord,
      setPermissionDevice,
      collapsed,
      setCollapsed,
      openApp,
      setOpenApp,
      ...props
    }: ControlBarProps,
    ref,
  ) => {
    const { t } = useI18n();
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [settingVis, setSettingVis] = React.useState(false);
    const layoutContext = useMaybeLayoutContext();
    const inviteTextRef = React.useRef<HTMLDivElement>(null);
    const enhanceChatRef = React.useRef<EnhancedChatExports>(null);
    const [chatMsg, setChatMsg] = useRecoilState(chatMsgState);
    const controlLeftRef = React.useRef<HTMLDivElement>(null);
    const [controlWidth, setControlWidth] = React.useState(
      controlLeftRef.current ? controlLeftRef.current.clientWidth : window.innerWidth,
    );

    // 当controlLeftRef的大小发生变化时，更新controlWidth
    React.useEffect(() => {
      const resizeObserver = new ResizeObserver(() => {
        if (controlLeftRef.current) {
          setControlWidth(controlLeftRef.current.clientWidth);
        }
      });
      if (controlLeftRef.current) {
        resizeObserver.observe(controlLeftRef.current);
      }
      return () => {
        resizeObserver.disconnect();
      };
    }, [controlLeftRef.current]);

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
    const showText = React.useMemo(() => {
      if (controlWidth < 700) {
        return false;
      } else {
        return variation === 'textOnly' || variation === 'verbose';
      }
    }, [variation, controlWidth]);

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
    const [key, setKey] = React.useState<TabKey>('general');
    const settingsRef = React.useRef<SettingsExports>(null);
    const [messageApi, contextHolder] = message.useMessage();
    const [uState, setUState] = useRecoilState(userState);
    const [virtualMask, setVirtualMask] = useRecoilState(virtualMaskState);
    const closeSetting = async () => {
      if (settingsRef.current && room) {
        settingsRef.current.removeVideo();
        // 更新用户名 ------------------------------------------------------
        const newName = settingsRef.current.username;
        if (
          newName !== '' &&
          newName !== (room.localParticipant?.name || room.localParticipant.identity)
        ) {
          saveUsername(newName);
          await room.localParticipant?.setMetadata(JSON.stringify({ name: newName }));
          await room.localParticipant.setName(newName);
          messageApi.success(t('msg.success.user.username.change'));
        } else if (newName == (room.localParticipant?.name || room.localParticipant.identity)) {
        } else {
          messageApi.error(t('msg.error.user.username.change'));
        }
        // 更新其他设置 ------------------------------------------------
        await updateSettings(settingsRef.current.state);
        // 通知socket，进行状态的更新 -----------------------------------
        socket.emit('update_user_status');
        socket.emit('reload_virtual', {
          identity: room.localParticipant.identity,
          roomId: room.name,
          reloading: false,
        });
      }
      setVirtualMask(false);
    };

    // 打开设置面板 -----------------------------------------------------------
    const openSettings = async (tab: TabKey) => {
      setKey(tab);
      setSettingVis(true);
      if (settingsRef.current && tab === 'video') {
        await settingsRef.current.startVideo();
      }
    };

    React.useImperativeHandle(
      ref,
      () =>
        ({
          openSettings,
        } as ControlBarExport),
    );

    // [chat] -----------------------------------------------------------------------------------------------------
    const [chatOpen, setChatOpen] = React.useState(false);
    const onChatClose = () => {
      setChatOpen(false);
    };
    const sendFileConfirm = (onOk: () => Promise<void>) => {
      Modal.confirm({
        title: t('common.send'),
        content: t('common.send_file_or'),
        onOk,
      });
    };

    // [more] -----------------------------------------------------------------------------------------------------
    const [openMore, setOpenMore] = React.useState(false);
    const [moreType, setMoreType] = React.useState<'record' | 'participant'>('record');
    const [openShareModal, setOpenShareModal] = React.useState(false);
    const [selectedParticipant, setSelectedParticipant] = React.useState<Participant | null>(null);
    const [username, setUsername] = React.useState<string>('');
    const [openNameModal, setOpenNameModal] = React.useState(false);
    // const [openAppModal, setOpenAppModal] = React.useState(false);
    const participantList = React.useMemo(() => {
      return Object.entries(roomSettings.participants);
    }, [roomSettings]);
    const isOwner = React.useMemo(() => {
      return roomSettings.ownerId === room?.localParticipant.identity;
    }, [roomSettings.ownerId, room?.localParticipant.identity]);

    // [record] -----------------------------------------------------------------------------------------------------
    const [openRecordModal, setOpenRecordModal] = React.useState(false);
    const [isDownload, setIsDownload] = React.useState(false);
    const isRecording = React.useMemo(() => {
      return roomSettings.record.active;
    }, [roomSettings.record]);

    const sendRecordRequest = (data: {
      room: string;
      type: 'start' | 'stop';
      egressId?: string;
    }): Promise<Response> => {
      const url = new URL(RECORD_URL, window.location.origin);
      return fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    };

    const onClickRecord = async () => {
      if (!room && isOwner) return;

      if (!isRecording) {
        setOpenRecordModal(true);
      } else {
        // 停止录制
        if (roomSettings.record.egressId && roomSettings.record.egressId !== '') {
          const response = await sendRecordRequest({
            room: room!.name,
            type: 'stop',
            egressId: roomSettings.record.egressId,
          });

          if (!response.ok) {
            let { error } = await response.json();
            messageApi.error(error);
          } else {
            messageApi.success(t('msg.success.record.stop'));
            setIsDownload(true);
            await updateRecord(false);
            setOpenRecordModal(true);
          }
        }
      }
    };

    const startRecord = async () => {
      if (isRecording || !room) return;

      if (isOwner) {
        // host request to start recording
        const response = await sendRecordRequest({
          room: room.name,
          type: 'start',
        });
        if (!response.ok) {
          let { error } = await response.json();
          messageApi.error(error);
        } else {
          let { egressId, filePath } = await response.json();
          messageApi.success(t('msg.success.record.start'));
          const res = await updateRecord(true, egressId, filePath);
          // 这里有可能是房间数据出现问题，需要让所有参与者重新提供数据并重新updateRecord
          if (!res) {
            console.error('Failed to update record settings');
            socket.emit('refetch_room', {
              room: room.name,
              record: {
                active: true,
                egressId,
                filePath,
              },
            });
          }
          socket.emit('recording', {
            room: room.name,
          });
        }
        console.warn(roomSettings);
      } else {
        // participant request to start recording
        socket.emit('req_record', {
          room: room.name,
          senderName: room.localParticipant.name,
          senderId: room.localParticipant.identity,
          receiverId: roomSettings.ownerId,
          socketId: roomSettings.participants[roomSettings.ownerId].socketId,
        } as WsTo);
      }
    };

    const recordModalOnOk = async () => {
      if (!room) return;

      if (isDownload) {
        // copy link to clipboard
        // 创建一个新recording页面，相当于点击了a标签的href
        window.open(
          `${window.location.origin}/recording?room=${encodeURIComponent(room.name)}`,
          '_blank',
        );
        setIsDownload(false);
      } else {
        await startRecord();
      }
      setOpenRecordModal(false);
    };

    const recordModalOnCancel = () => {
      if (isDownload) {
        setIsDownload(false);
      }
      setOpenRecordModal(false);
    };

    const onClickApp = async () => {
      if (!room) return;

      // 打开Notion应用
      setOpenApp(true);
    };

    return (
      <div {...htmlProps} className={styles.controls}>
        {contextHolder}
        <div className={styles.controls_left} ref={controlLeftRef}>
          {visibleControls.microphone && (
            <div className="lk-button-group">
              <TrackToggle
                source={Track.Source.Microphone}
                showIcon={showIcon}
                onChange={microphoneOnChange}
                onDeviceError={(error) => {
                  setPermissionDevice(Track.Source.Microphone);
                  onDeviceError?.({ source: Track.Source.Microphone, error });
                }}
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
                onDeviceError={(error) => {
                  setPermissionDevice(Track.Source.Camera);
                  onDeviceError?.({ source: Track.Source.Camera, error });
                }}
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
              style={{ height: '46px' }}
              source={Track.Source.ScreenShare}
              captureOptions={{ audio: uState.openShareAudio, selfBrowserSurface: 'include' }}
              showIcon={showIcon}
              onChange={onScreenShareChange}
              onDeviceError={(error) => {
                setPermissionDevice(Track.Source.ScreenShare);
                onDeviceError?.({ source: Track.Source.ScreenShare, error });
              }}
            >
              {showText &&
                (isScreenShareEnabled ? t('common.stop_share') : t('common.share_screen'))}
            </TrackToggle>
          )}
          {visibleControls.chat && (
            <ChatToggle
              controlWidth={controlWidth}
              enabled={chatOpen}
              onClicked={() => {
                setChatOpen(!chatOpen);
              }}
              count={chatMsg.unhandled}
            ></ChatToggle>
          )}
          {room && roomSettings.participants && visibleControls.microphone && (
            <MoreButton
              controlWidth={controlWidth}
              setOpenMore={setOpenMore}
              setMoreType={setMoreType}
              onSettingOpen={async () => {
                setSettingVis(true);
              }}
              onClickRecord={onClickRecord}
              onClickManage={fetchSettings}
              onClickApp={onClickApp}
              isRecording={isRecording}
            ></MoreButton>
          )}
        </div>

        {visibleControls.leave && (
          <DisconnectButton>
            {showIcon && <LeaveIcon />}
            {showText && t('common.leave')}
          </DisconnectButton>
        )}
        {/* <StartMediaButton /> */}
        {room && (
          <EnhancedChat
            ref={enhanceChatRef}
            messageApi={messageApi}
            open={chatOpen}
            setOpen={setChatOpen}
            onClose={onChatClose}
            room={room}
            sendFileConfirm={sendFileConfirm}
          ></EnhancedChat>
        )}
        <Drawer
          {...DEFAULT_DRAWER_PROP}
          title={t('common.setting')}
          width={'640px'}
          open={settingVis}
          onClose={() => {
            setSettingVis(false);
            closeSetting();
          }}
          extra={DrawerCloser({
            on_clicked: () => {
              setSettingVis(false);
              closeSetting();
            },
          })}
        >
          <div className={styles.setting_container}>
            {room && (
              <Settings
                ref={settingsRef}
                close={settingVis}
                messageApi={messageApi}
                room={room.name}
                username={userChoices.username}
                tab={{ key, setKey }}
                // saveChanges={saveChanges}
                setUserStatus={setUserStatus}
                localParticipant={room.localParticipant}
              ></Settings>
            )}
          </div>
        </Drawer>
        <ParticipantManage
          open={openMore}
          setOpen={setOpenMore}
          room={room}
          participantList={participantList}
          setOpenShareModal={setOpenShareModal}
          roomSettings={roomSettings}
          selectedParticipant={selectedParticipant}
          setSelectedParticipant={setSelectedParticipant}
          setOpenNameModal={setOpenNameModal}
          setUsername={setUsername}
        ></ParticipantManage>
        {/* ------------- share room modal -------------------------------------------------------- */}
        <Modal
          open={openShareModal}
          onCancel={() => setOpenShareModal(false)}
          title={t('more.participant.invite.title')}
          okText={t('more.participant.invite.ok')}
          cancelText={t('more.participant.invite.cancel')}
          onOk={async () => {
            await navigator.clipboard.writeText(
              inviteTextRef.current?.innerText ||
                `${t('more.participant.invite.link')}: ${window.location.href}`,
            );
            setOpenShareModal(false);
          }}
        >
          <div className={styles.invite_container} ref={inviteTextRef}>
            <div className={styles.invite_container_item}>
              {room?.localParticipant.name} &nbsp;
              {t('more.participant.invite.texts.0')}
            </div>
            <div className={styles.invite_container_item}>
              <div className={styles.invite_container_item_justify}>
                {t('more.participant.invite.texts.1')}
                {t('more.participant.invite.web')}
                {t('more.participant.invite.add')}
              </div>
              <div>
                {t('more.participant.invite.link')}: {window.location.href}
              </div>
            </div>
            <div className={styles.invite_container_item}>
              <div className={styles.invite_container_item_justify}>
                {t('more.participant.invite.texts.2')}
                <strong>{`${window.location.href}`}</strong>
                {t('more.participant.invite.add')}
              </div>
              <div>
                {t('more.participant.invite.room')}: {room?.name}
              </div>
            </div>
          </div>
        </Modal>
        {/* -------------- control participant name modal ---------------------------------------- */}
        <Modal
          open={openNameModal}
          title={t('more.participant.set.control.change_name')}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          onCancel={() => {
            setOpenNameModal(false);
          }}
          onOk={() => {
            if (room && selectedParticipant) {
              socket.emit('control_participant', {
                room: room.name,
                senderName: room.localParticipant.name,
                senderId: room.localParticipant.identity,
                receiverId: selectedParticipant.identity,
                socketId: roomSettings.participants[selectedParticipant.identity].socketId,
                type: ControlType.ChangeName,
                username,
              } as WsControlParticipant);
            }
            setOpenNameModal(false);
          }}
        >
          <Input
            placeholder={t('settings.general.username')}
            value={username}
            style={{
              outline: '1px solid #22CCEE',
            }}
            onChange={(e) => {
              setUsername(e.target.value);
            }}
          ></Input>
        </Modal>
        {/* ---------------- record modal ------------------------------------------------------- */}
        <Modal
          open={openRecordModal}
          title={isDownload ? t('more.record.download') : t('more.record.title')}
          okText={
            isDownload
              ? t('more.record.to_download')
              : isOwner
              ? t('more.record.confirm')
              : t('more.record.confirm_request')
          }
          cancelText={t('more.record.cancel')}
          onCancel={recordModalOnCancel}
          onOk={recordModalOnOk}
        >
          {isDownload ? (
            <div>{t('more.record.download_msg')}</div>
          ) : (
            <div>{isOwner ? t('more.record.desc') : t('more.record.request')}</div>
          )}
        </Modal>

        <AppDrawer
          open={openApp}
          setOpen={setOpenApp}
          messageApi={messageApi}
        ></AppDrawer>
      </div>
    );
  },
);

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
