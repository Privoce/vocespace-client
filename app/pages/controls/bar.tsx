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
import {
  Button,
  Checkbox,
  CheckboxOptionType,
  Drawer,
  GetProp,
  Input,
  message,
  Modal,
  notification,
  Radio,
  Slider,
  Tooltip,
} from 'antd';
import { Participant, Track } from 'livekit-client';
import * as React from 'react';
import styles from '@/styles/controls.module.scss';
import { Settings, SettingsExports, TabKey } from './settings/settings';
import { useRecoilState, waitForAll } from 'recoil';
import {
  chatMsgState,
  socket,
  userState,
  virtualMaskState,
} from '@/app/[spaceName]/PageClientImpl';
import { getState, ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { isMobile as is_moblie, UserStatus } from '@/lib/std';
import { EnhancedChat, EnhancedChatExports } from '@/app/pages/chat/chat';
import { ChatToggle } from './toggles/chat_toggle';
import { MoreButton } from './toggles/more_button';
import { ControlType, WsBase, WsControlParticipant, WsTo } from '@/lib/std/device';
import { DEFAULT_DRAWER_PROP, DrawerCloser } from './drawer_tools';
import { ParticipantManage } from '../participant/manage';
import { api } from '@/lib/api';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import equal from 'fast-deep-equal';
import { Reaction } from './widgets/reaction';
import { ChatMsgItem } from '@/lib/std/chat';
import { AICutService } from '@/lib/ai/cut';
import { AICutAnalysisService, AICutDeps, downloadMarkdown } from '@/lib/ai/analysis';
import { InfoCircleFilled } from '@ant-design/icons';

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
   * This will enable the user to have the same device choices when they rejoin the space.
   * @defaultValue true
   * @alpha
   */
  saveUserChoices?: boolean;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  spaceInfo: SpaceInfo;
  fetchSettings: () => Promise<void>;
  updateRecord: (active: boolean, egressId?: string, filePath?: string) => Promise<boolean>;
  setPermissionDevice: (device: Track.Source) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
  toRenameSettings: () => void;
}

export interface ControlBarExport {
  openSettings: (key: TabKey, isDefineStatus?: boolean) => void;
}

/**
 * The `ControlBar` prefab gives the user the basic user interface to control their
 * media devices (camera, microphone and screen share), open the `Chat` and leave the space.
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
      spaceInfo,
      fetchSettings,
      updateRecord,
      setPermissionDevice,
      collapsed,
      setCollapsed,
      openApp,
      setOpenApp,
      toRenameSettings,
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
    const [aiCutModalOpen, setAICutModalOpen] = React.useState(false);
    const [cutFreq, setCutFreq] = React.useState(3);
    const aiCutServiceRef = React.useRef<AICutService>(new AICutService());
    const [controlWidth, setControlWidth] = React.useState(
      controlLeftRef.current ? controlLeftRef.current.clientWidth : window.innerWidth,
    );
    const [openCutTimeline, setOpenCutTimeline] = React.useState<boolean>(false);
    const [noteApi, noteContextHolder] = notification.useNotification();
    const isMobile = React.useMemo(() => {
      return is_moblie();
    }, []);

    const controlSize = React.useMemo(() => {
      return (isMobile ? 'small' : 'middle') as SizeType;
    }, [isMobile]);
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
    const isTooLittleSpace = useMediaQuery(`(max-width: ${isChatOpen ? 1000 : 720}px)`);

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
      if (controlWidth < 720) {
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
    const space = useMaybeRoomContext();
    const [key, setKey] = React.useState<TabKey>('general');
    const settingsRef = React.useRef<SettingsExports>(null);
    const [messageApi, contextHolder] = message.useMessage();
    const [uState, setUState] = useRecoilState(userState);
    const [virtualMask, setVirtualMask] = useRecoilState(virtualMaskState);
    const closeSetting = async () => {
      if (settingsRef.current && space) {
        settingsRef.current.removeVideo();
        // 更新用户名 ------------------------------------------------------
        const newName = settingsRef.current.username;
        if (
          newName !== '' &&
          newName !== (space.localParticipant?.name || space.localParticipant.identity)
        ) {
          saveUsername(newName);
          await space.localParticipant?.setMetadata(JSON.stringify({ name: newName }));
          await space.localParticipant.setName(newName);
          messageApi.success(t('msg.success.user.username.change'));
        } else if (newName == (space.localParticipant?.name || space.localParticipant.identity)) {
        } else {
          messageApi.error(t('msg.error.user.username.change'));
        }
        // 更新其他设置 ------------------------------------------------
        // await updateSettings(settingsRef.current.state);
        if (!equal(getState(uState), settingsRef.current.state)) {
          await updateSettings(settingsRef.current.state);
          // 通知socket，进行状态的更新 -----------------------------------
          socket.emit('update_user_status', {
            space: space.name,
          } as WsBase);
        }
        socket.emit('reload_virtual', {
          identity: space.localParticipant.identity,
          roomId: space.name,
          reloading: false,
        });
      }
      setVirtualMask(false);
    };

    // 打开设置面板 -----------------------------------------------------------
    const openSettings = async (tab: TabKey, isDefineStatus?: boolean) => {
      setKey(tab);
      setSettingVis(true);
      if (settingsRef.current && tab === 'video') {
        await settingsRef.current.startVideo();
      }
      if (isDefineStatus) {
        if (settingsRef.current) {
          settingsRef.current.setAppendStatus(true);
        } else {
          let finish = false;
          const interval = setInterval(() => {
            if (settingsRef.current && !finish) {
              settingsRef.current.setAppendStatus(true);
              finish = true;
              clearInterval(interval);
            }
          }, 300);
        }
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
    const sendFileConfirm = (onOk: (abortController?: AbortController) => Promise<ChatMsgItem>) => {
      const modal = Modal.confirm({
        title: t('common.send'),
        content: t('common.send_file_or'),
        okText: t('common.send'),
        cancelText: t('common.cancel'),
        onOk: async () => {
          modal.destroy();
          await sendingFile(onOk);
        },
      });
    };

    const sendingFile = async (
      onOk: (abortController?: AbortController) => Promise<ChatMsgItem>,
    ) => {
      // 创建 AbortController 来控制上传取消
      const abortController = new AbortController();
      let isUploading = false;

      const sending = Modal.confirm({
        title: t('common.send'),
        content: t('common.sending'),
        okText: (
          <Button type="primary" loading>
            {t('common.sending')}
          </Button>
        ),
        cancelText: t('common.cancel'),
        onCancel: () => {
          // 如果正在上传，则中断上传
          if (isUploading) {
            abortController.abort();
            messageApi.info({
              content: t('msg.info.file.upload_cancelled'),
              duration: 2,
            });
          }
        },
      });

      try {
        isUploading = true;
        // 传递 abortController 给上传函数
        const fileMessage = await onOk(abortController);
        isUploading = false;

        if (fileMessage) {
          sending.destroy();
          socket.emit('chat_file', fileMessage);
          messageApi.success({
            content: t('msg.success.file.upload'),
            duration: 2,
          });
        }
      } catch (error: any) {
        isUploading = false;
        sending.destroy();

        if (error.name === 'AbortError') {
          // 用户取消了上传
          console.log('Upload cancelled by user');
        } else {
          // 其他错误
          // messageApi.error({
          //   content: `${t('msg.error.file.upload')}: ${error.message}`,
          //   duration: 3,
          // });
          console.error(error);
        }
      }
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
      return Object.entries(spaceInfo.participants);
    }, [spaceInfo]);
    const isOwner = React.useMemo(() => {
      return spaceInfo.ownerId === space?.localParticipant.identity;
    }, [spaceInfo.ownerId, space?.localParticipant.identity]);

    // [record] -----------------------------------------------------------------------------------------------------
    const [openRecordModal, setOpenRecordModal] = React.useState(false);
    const [isDownload, setIsDownload] = React.useState(false);
    const isRecording = React.useMemo(() => {
      return spaceInfo.record.active;
    }, [spaceInfo.record]);

    const onClickRecord = async () => {
      if (!space && isOwner) return;

      if (!isRecording) {
        setOpenRecordModal(true);
      } else {
        // 停止录制
        if (spaceInfo.record.egressId && spaceInfo.record.egressId !== '') {
          const response = await api.sendRecordRequest({
            spaceName: space!.name,
            type: 'stop',
            egressId: spaceInfo.record.egressId,
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
      if (isRecording || !space) return;

      if (isOwner) {
        // host request to start recording
        const response = await api.sendRecordRequest({
          spaceName: space.name,
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
              space: space.name,
              record: {
                active: true,
                egressId,
                filePath,
              },
            });
          }
          socket.emit('recording', {
            space: space.name,
          });
        }
        console.warn(spaceInfo);
      } else {
        // participant request to start recording
        socket.emit('req_record', {
          space: space.name,
          senderName: space.localParticipant.name,
          senderId: space.localParticipant.identity,
          receiverId: spaceInfo.ownerId,
          socketId: spaceInfo.participants[spaceInfo.ownerId].socketId,
        } as WsTo);
      }
    };

    const recordModalOnOk = async () => {
      if (!space) return;

      if (isDownload) {
        // copy link to clipboard
        // 创建一个新recording页面，相当于点击了a标签的href
        window.open(
          `${window.location.origin}/recording?room=${encodeURIComponent(space.name)}`,
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
      if (!space) return;
      setOpenApp(true);
    };

    // ai -----------------------------------------------------------------------------------------
    const onClickAI = async () => {
      setAICutModalOpen(true);
    };

    const [aiCutDeps, setAICutDeps] = React.useState<AICutDeps[]>(['screen']);

    const aiCutOptions: CheckboxOptionType<AICutDeps>[] = React.useMemo(() => {
      return [
        { label: t('ai.cut.share_screen'), value: 'screen' },
        { label: t('ai.cut.share_todo'), value: 'todo' },
        { label: t('ai.cut.share_time'), value: 'time' },
      ];
    }, [t]);

    const aiCutOptionsChange: GetProp<typeof Checkbox.Group, 'onChange'> = (checkedValues) => {
      setAICutDeps(checkedValues as AICutDeps[]);
    };

    const confirmOpenAICut = async (run: boolean) => {
      if (run) {
        // 开启AI截屏服务 --------------------------------------------------------
        if (!space?.localParticipant.isScreenShareEnabled) {
          noteApi.open({
            message: t('ai.cut.ask_permission_title'),
            description: t('ai.cut.ask_permission'),
            duration: 5,
            btn: (
              <Button
                type="primary"
                onClick={() => {
                  space?.localParticipant.setScreenShareEnabled(true);
                }}
              >
                {t('common.open')}
              </Button>
            ),
          });
        }

        if (space?.localParticipant.isScreenShareEnabled) {
          await aiCutServiceRef.current.start(cutFreq, openCutTimeline, async (lastScreenShot) => {
            if (space && space.localParticipant) {
              const response = await api.ai.analysis(
                space.name,
                space.localParticipant.identity,
                lastScreenShot,
              );
              if (response.ok) {
                console.warn('AI cut screenshot sent for analysis');
              } else {
                console.error('Failed to send AI cut screenshot for analysis');
              }
            }
          });
        }
      } else {
        aiCutServiceRef.current.stop();
        const response = await api.ai.stop(space!.name, space!.localParticipant.identity);
        if (response.ok) {
          const { md }: { md: string } = await response.json();
          console.warn('Downloaded AI cut analysis markdown:', md);
          // 如果md不为空，则下载
          if (!!md) {
            downloadMarkdown(md);
          }
        } else {
          messageApi.error(t('msg.error.ai.cut.download_analysis'));
        }
        aiCutServiceRef.current.clearScreenshots();
      }
      setAICutModalOpen(false);
    };

    const checkMyAICutAnalysis = async () => {
      if (space && space.localParticipant) {
        const response = await api.ai.downloadMarkdown(space.name, space.localParticipant.identity);
        if (response.ok) {
          const { md }: { md: string } = await response.json();
          console.warn('Downloaded AI cut analysis markdown:', md);
          // 如果md不为空，则下载
          if (!!md) {
            downloadMarkdown(md);
          }
        } else {
          messageApi.error(t('msg.error.ai.cut.download_analysis'));
        }
      }
    };

    // 当是手机的情况下需要适当增加marginBottom，因为手机端自带的Tabbar会遮挡
    return (
      <div
        {...htmlProps}
        className={styles.controls}
        style={{
          marginBottom: isMobile ? '62px' : 'auto',
        }}
      >
        {noteContextHolder}
        {contextHolder}
        <div
          className={styles.controls_left}
          ref={controlLeftRef}
          style={{
            width: isMobile ? 'calc(100% - 64px)' : 'calc(100% - 100px)',
          }}
        >
          {visibleControls.microphone && (
            <div className="lk-button-group">
              <TrackToggle
                style={{ height: 46, padding: controlSize === 'small' ? 7 : 15 }}
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
                  style={{ height: 46, padding: controlSize === 'small' ? 7 : 15 }}
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
                style={{ height: 46, padding: controlSize === 'small' ? 7 : 15 }}
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
                  style={{ height: 46, padding: controlSize === 'small' ? 7 : 15 }}
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
              style={{ height: 46, padding: 15 }}
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
          {space && spaceInfo.participants && visibleControls.microphone && (
            <Reaction
              updateSettings={updateSettings}
              space={space.name}
              size={controlSize}
              controlWidth={controlWidth}
              spaceInfo={spaceInfo}
            ></Reaction>
          )}
          {visibleControls.chat && !isMobile && (
            <ChatToggle
              controlWidth={controlWidth}
              enabled={chatOpen}
              onClicked={() => {
                setChatOpen(!chatOpen);
              }}
              count={chatMsg.unhandled}
            ></ChatToggle>
          )}
          {space && spaceInfo.participants && visibleControls.microphone && (
            <MoreButton
              size={controlSize}
              controlWidth={controlWidth}
              setOpenMore={setOpenMore}
              setMoreType={setMoreType}
              onSettingOpen={async () => {
                setSettingVis(true);
              }}
              onClickAI={onClickAI}
              onClickRecord={onClickRecord}
              onClickManage={fetchSettings}
              onClickApp={onClickApp}
              isRecording={isRecording}
              chat={
                isMobile
                  ? {
                      visible: visibleControls.chat || false,
                      enabled: chatOpen,
                      count: chatMsg.unhandled,
                      onClicked: () => {
                        setChatOpen(!chatOpen);
                      },
                    }
                  : undefined
              }
            ></MoreButton>
          )}
        </div>

        {visibleControls.leave && (
          <DisconnectButton style={{ height: 46 }}>
            {showIcon && <LeaveIcon />}
            {showText && t('common.leave')}
          </DisconnectButton>
        )}
        {/* <StartMediaButton /> */}
        {space && (
          <EnhancedChat
            ref={enhanceChatRef}
            messageApi={messageApi}
            open={chatOpen}
            setOpen={setChatOpen}
            onClose={onChatClose}
            space={space}
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
            {space && (
              <Settings
                ref={settingsRef}
                close={settingVis}
                messageApi={messageApi}
                space={space.name}
                username={userChoices.username}
                tab={{ key, setKey }}
                // saveChanges={saveChanges}
                setUserStatus={setUserStatus}
                localParticipant={space.localParticipant}
                spaceInfo={spaceInfo}
              ></Settings>
            )}
          </div>
        </Drawer>
        <ParticipantManage
          open={openMore}
          setOpen={setOpenMore}
          space={space}
          participantList={participantList}
          setOpenShareModal={setOpenShareModal}
          spaceInfo={spaceInfo}
          selectedParticipant={selectedParticipant}
          setSelectedParticipant={setSelectedParticipant}
          setOpenNameModal={setOpenNameModal}
          setUsername={setUsername}
          updateSettings={updateSettings}
          toRenameSettings={toRenameSettings}
        ></ParticipantManage>
        {/* ------------- share space modal -------------------------------------------------------- */}
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
              {space?.localParticipant.name} &nbsp;
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
                {t('more.participant.invite.room')}: {space?.name}
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
            if (space && selectedParticipant) {
              socket.emit('control_participant', {
                space: space.name,
                senderName: space.localParticipant.name,
                senderId: space.localParticipant.identity,
                receiverId: selectedParticipant.identity,
                socketId: spaceInfo.participants[selectedParticipant.identity].socketId,
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
        {/* -------------------- ai cut modal --------------------------------------------------- */}
        <Modal
          open={aiCutModalOpen}
          title={t('ai.cut.title')}
          footer={null}
          okText={aiCutServiceRef.current.isRunning ? t('common.close') : t('common.open')}
          cancelText={t('common.cancel')}
          onCancel={() => {
            setAICutModalOpen(false);
          }}
        >
          <div>{t('more.ai.desc')}</div>

          {space?.localParticipant.identity === spaceInfo.ownerId && (
            <>
              {' '}
              <div className={styles.ai_cut_line}>
                <span> {t('ai.cut.freq')}</span>
                <Tooltip title={t('ai.cut.freq_desc')} trigger={['hover']}>
                  <InfoCircleFilled></InfoCircleFilled>
                </Tooltip>
              </div>{' '}
              <Slider min={1} max={15} value={cutFreq} onChange={(v) => setCutFreq(v)} step={0.5} />
            </>
          )}

          <div className={styles.ai_cut_line}>
            <div className={styles.ai_cut_line}>
              <span> {t('ai.cut.source_dep')}</span>
              <Tooltip title={t('ai.cut.source_dep_desc')} trigger={['hover']}>
                <InfoCircleFilled></InfoCircleFilled>
              </Tooltip>
            </div>
            <div style={{ width: '100%' }}>
              <Checkbox.Group
                options={aiCutOptions}
                defaultValue={['screen', 'todo']}
                onChange={aiCutOptionsChange}
              />
            </div>
          </div>
          <div className={styles.ai_cut_line}>
            <div className={styles.ai_cut_line}>
              <span> {t('ai.cut.open')}</span>
            </div>
            <div style={{ width: '100%' }}>
              {space && (
                <Radio.Group
                  size="large"
                  block
                  value={spaceInfo.participants[space.localParticipant.identity]?.ai.cut || false}
                  onChange={(e) => {
                    confirmOpenAICut(e.target.value);
                  }}
                >
                  <Radio.Button value={true}>{t('common.open')}</Radio.Button>
                  <Radio.Button value={false}>{t('common.close')}</Radio.Button>
                </Radio.Group>
              )}
            </div>
          </div>

          {/* <Button onClick={checkMyAICutAnalysis}>{t('ai.cut.myAnalysis')}</Button> */}
        </Modal>
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
