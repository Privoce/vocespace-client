import { useI18n } from '@/lib/i18n/i18n';
import {
  DisconnectButton,
  LeaveIcon,
  TrackToggle,
  useLocalParticipantPermissions,
  useMaybeLayoutContext,
  useMaybeRoomContext,
  usePersistentUserChoices,
} from '@livekit/components-react';
import { Button, Drawer, Input, message, Modal, Popover } from 'antd';
import { Participant, Track } from 'livekit-client';
import * as React from 'react';
import styles from '@/styles/controls.module.scss';
import { useUserStore, useRoomStore } from '@/lib/store';
import { Settings, TabKey } from './settings/settings';
import type { SettingsExports } from './settings/settings';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { AICutParticipantConf, getState, ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { ReadableConf } from '@/lib/std/conf';
import { isMobile as is_mobile, isSpaceManager, UserStatus } from '@/lib/std';
import { EnhancedChat, EnhancedChatExports } from '@/app/pages/chat/chat';
import { ChatToggle } from './toggles/chat_toggle';
import { MoreButton } from './toggles/more_button';
import { ControlType, MediaDeviceKind, WsBase, WsControlParticipant, WsTo } from '@/lib/std/device';
import { DEFAULT_DRAWER_PROP, DrawerCloser } from './drawer_tools';
import { ParticipantManage } from '../participant/manage';
import { api } from '@/lib/api';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import equal from 'fast-deep-equal';
import { ChatMsgItem } from '@/lib/std/chat';
import { AICutService } from '@/lib/ai/cut';
import { useWork, Work, WorkModal } from './widgets/work';
import { AICutAnalysisSettingsPanel, useAICutAnalysisSettings } from './widgets/ai';
import { DEFAULT_WINDOW_ADJUST_WIDTH } from '@/lib/std/window';
import { usePlatformUserInfo } from '@/lib/hooks/platform';
import { markExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import { DevicesSelector } from '@/app/api/devices/device_selector';
import { useControlsSettings, useControlsRecord, useControlsChat } from './hooks/index';

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
  startOrStopAICutAnalysis: (
    freq: number,
    conf: AICutParticipantConf,
    reload?: boolean,
  ) => Promise<void>;
  openAIServiceAskNote: () => void;
  downloadAIMdReport?: () => Promise<void>;
  config: ReadableConf;
}

export interface ControlBarExport {
  openSettings: (key: TabKey, isDefineStatus?: boolean) => void;
  showAICutAnalysisSettings: (open: boolean) => void;
  isChatOpen: boolean;
  setChatOpen: (open: boolean) => void;
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
      startOrStopAICutAnalysis,
      openAIServiceAskNote,
      downloadAIMdReport,
      config,
      ...props
    }: ControlBarProps,
    ref,
  ) => {
    const { t } = useI18n();
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const layoutContext = useMaybeLayoutContext();
    const inviteTextRef = React.useRef<HTMLDivElement>(null);
    const enhanceChatRef = React.useRef<EnhancedChatExports>(null);
    const chatMsg = useRoomStore((s) => s.chatMsg);
    const controlLeftRef = React.useRef<HTMLDivElement>(null);
    const [aiCutModalOpen, setAICutModalOpen] = React.useState(false);
    const aiCutServiceRef = React.useRef<AICutService>(new AICutService());
    const [controlWidth, setControlWidth] = React.useState(
      controlLeftRef.current ? controlLeftRef.current.clientWidth : window.innerWidth,
    );
    const isMobile = React.useMemo(() => {
      return is_mobile();
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
    const isTooLittleSpace = useMediaQuery(
      `(max-width: ${isChatOpen ? 1000 : DEFAULT_WINDOW_ADJUST_WIDTH}px)`,
    );

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
      if (controlWidth < DEFAULT_WINDOW_ADJUST_WIDTH) {
        return false;
      } else {
        return variation === 'textOnly' || variation === 'verbose';
      }
    }, [variation, controlWidth]);

    const browserSupportsScreenSharing = supportsScreenSharing();

    const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(false);
    const [audioMenuOpen, setAudioMenuOpen] = React.useState(false);
    const [videoMenuOpen, setVideoMenuOpen] = React.useState(false);

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
    const space = useMaybeRoomContext();

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

    const renderDeviceMenuTrigger = React.useCallback(() => {
      return <button className="lk-button lk-button-menu" type="button" aria-label="devices" />;
    }, []);

    // settings ------------------------------------------------------------------------------------------
    const { showAI } = usePlatformUserInfo({
      space,
      uid: space?.localParticipant.identity,
      onEnterRoom: () => {
        socket.emit('update_user_status', {
          space: space!.name,
        } as WsBase);
      },
    });
    // [more] -----------------------------------------------------------------------------------------------------
    const [openMore, setOpenMore] = React.useState(false);
    const [moreType, setMoreType] = React.useState<'record' | 'participant'>('record');
    const [openShareModal, setOpenShareModal] = React.useState(false);
    const [selectedParticipant, setSelectedParticipant] = React.useState<Participant | null>(null);
    const [username, setUsername] = React.useState<string>('');
    const [openNameModal, setOpenNameModal] = React.useState(false);
    const remoteApp = useRoomStore((s) => s.remoteApp);
    const participantList = React.useMemo(() => {
      return Object.entries(spaceInfo.participants);
    }, [spaceInfo]);
    const isManager = React.useMemo(() => {
      return isSpaceManager(spaceInfo, space?.localParticipant.identity || '').isManager;
    }, [spaceInfo.ownerId, space?.localParticipant.identity]);

    const [messageApi, contextHolder] = message.useMessage();
    const uState = useUserStore();
    const {
      settingVis, setSettingVis,
      key, setKey,
      settingsRef,
      closeSetting, openSettings,
    } = useControlsSettings({ space, saveUsername, updateSettings });
    const {
      openRecordModal, setOpenRecordModal,
      isDownload, setIsDownload,
      isRecording,
      onClickRecord,
      recordModalOnOk,
      recordModalOnCancel,
    } = useControlsRecord({ space, isManager, spaceInfo, updateRecord });
    const {
      chatOpen, setChatOpen,
      onChatClose,
      sendFileConfirm, sendingFile,
    } = useControlsChat();

    const onClickApp = async () => {
      if (!space) return;
      useRoomStore.getState().setRemoteApp({
        participantId: space.localParticipant.identity,
        participantName: space.localParticipant.name,
        auth: 'write',
      });
      setOpenApp(true);
    };

    // ai -----------------------------------------------------------------------------------------
    const {
      aiCutDeps,
      setAICutDeps,
      extraction,
      setExtraction,
      cutFreq,
      setCutFreq,
      cutBlur,
      setCutBlur,
      isServiceOpen,
      setIsServiceOpen,
      aiCutOptions,
      aiCutOptionsChange,
    } = useAICutAnalysisSettings({
      space,
      spaceInfo,
    });

    const onClickAI = async () => {
      setAICutModalOpen(true);
    };

    const saveAICutServiceSettings = async () => {
      const response = await api.updateSpaceInfo(space!.name, {
        ai: {
          cut: {
            ...spaceInfo.ai.cut,
            freq: cutFreq,
          },
        },
      });

      if (!response.ok) {
        let { error } = await response.json();
        messageApi.error(error);
        setAICutModalOpen(false);
        return;
      }
      // await updateSettings({
      //   ai: {
      //     cut: {
      //       enabled: isServiceOpen,
      //       todo: aiCutDeps.includes('todo'),
      //       spent: aiCutDeps.includes('spent'),
      //     },
      //   },
      // });

      setAICutModalOpen(false);
      if (space && !space.localParticipant.isScreenShareEnabled && isServiceOpen) {
        openAIServiceAskNote();
      }
      const includeSpent = aiCutDeps.includes('spent');
      const includeTodo = aiCutDeps.includes('todo');
      let reload = true;
      // 判断，如果spent, todo的选中状态或cutFreq与之前不同则需要reload
      const { spent, todo } = spaceInfo.participants[space!.localParticipant.identity]?.ai.cut;
      if (spent === includeSpent && todo === includeTodo && spaceInfo.ai.cut.freq === cutFreq) {
        reload = false;
      }

      await startOrStopAICutAnalysis(
        cutFreq,
        {
          enabled: isServiceOpen,
          spent: includeSpent,
          todo: includeTodo,
          extraction,
          blur: cutBlur,
        },
        reload,
      );
    };

    // --- work -----------------------------------------------------------------------------------------
    const {
      openModal: workModalOpen,
      setOpenModal: setWorkModalOpen,
      enabled: workEnabled,
      setEnabled: setWorkEnabled,
      isUseAI,
      setIsUseAI,
      isSync,
      setIsSync,
      videoBlur,
      setVideoBlur,
      screenBlur,
      setScreenBlur,
      handleWorkMode,
      startOrStopWork,
      lastAICutConfig,
    } = useWork({
      space,
      spaceInfo,
      messageApi,
      startOrStopAICutAnalysis,
      downloadAIMdReport,
    });

    React.useImperativeHandle(
      ref,
      () =>
        ({
          openSettings,
          showAICutAnalysisSettings: setAICutModalOpen,
          isChatOpen: chatOpen, // 使用 chatOpen 而不是 isChatOpen，因为 chatOpen 是实际控制聊天窗口的状态
          setChatOpen,
        }) as ControlBarExport,
    );
    // 当是手机的情况下需要适当增加marginBottom，因为手机端自带的Tabbar会遮挡
    return (
      <div
        {...htmlProps}
        className={styles.controls}
        style={{
          marginBottom: isMobile ? 'auto' :  4,
        }}
      >
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
                <Popover
                  trigger="click"
                  open={audioMenuOpen}
                  onOpenChange={setAudioMenuOpen}
                  content={
                    <DevicesSelector
                      enabled={audioMenuOpen}
                      kind={MediaDeviceKind.AudioInput}
                      preferredDeviceId={userChoices.audioDeviceId}
                      requestPermissions
                      err={(error) => {
                        setPermissionDevice(Track.Source.Microphone);
                        onDeviceError?.({ source: Track.Source.Microphone, error });
                      }}
                      onDeviceChanged={(deviceId) => {
                        saveAudioInputDeviceId(deviceId ?? 'default');
                        setAudioMenuOpen(false);
                      }}
                    />
                  }
                  placement="top"
                >
                  {renderDeviceMenuTrigger()}
                </Popover>
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
                <Popover
                  trigger="click"
                  open={videoMenuOpen}
                  onOpenChange={setVideoMenuOpen}
                  content={
                    <DevicesSelector
                      enabled={videoMenuOpen}
                      kind={MediaDeviceKind.VideoInput}
                      preferredDeviceId={userChoices.videoDeviceId}
                      requestPermissions
                      err={(error) => {
                        setPermissionDevice(Track.Source.Camera);
                        onDeviceError?.({ source: Track.Source.Camera, error });
                      }}
                      onDeviceChanged={(deviceId) => {
                        saveVideoInputDeviceId(deviceId ?? 'default');
                        setVideoMenuOpen(false);
                      }}
                    />
                  }
                  placement="top"
                >
                  {renderDeviceMenuTrigger()}
                </Popover>
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
          {space && visibleControls.microphone && spaceInfo.ai.cut.enabled && showAI && (
            // <Reaction
            //   updateSettings={updateSettings}
            //   space={space.name}
            //   size={controlSize}
            //   controlWidth={controlWidth}
            //   spaceInfo={spaceInfo}
            // ></Reaction>

            <Work
              isStartWork={workEnabled}
              setIsStartWork={setWorkEnabled}
              setOpenModal={setWorkModalOpen}
              showText={showText}
              size={controlSize}
              controlWidth={controlWidth}
              spaceInfo={spaceInfo}
              space={space.name}
              startOrStopWork={startOrStopWork}
              localParticipant={space.localParticipant}
              lastAICutConfig={lastAICutConfig}
            ></Work>
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
              space={space}
              spaceInfo={spaceInfo}
              config={config}
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
          <DisconnectButton style={{ height: 46 }} onClick={() => markExplicitLeaveIntent()}>
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
            spaceInfo={spaceInfo}
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
                showAI={showAI}
                updateSettings={updateSettings}
                ref={settingsRef}
                close={settingVis}
                messageApi={messageApi}
                space={space}
                username={userChoices.username}
                tab={{ key, setKey }}
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
          messageApi={messageApi}
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
              {t('more.participant.invite.texts.0')
                .replace('$user', space?.localParticipant.name || '')
                .replace('$space', space?.name || '')}
            </div>
            <div className={styles.invite_container_item}>
              <div className={styles.invite_container_item_justify}>
                {t('more.participant.invite.texts.1').replace('$space', space?.name || '')}
              </div>
              <div>
                {t('more.participant.invite.link')}: {window.location.href}
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
              : isManager
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
            <div>{isManager ? t('more.record.desc') : t('more.record.request')}</div>
          )}
        </Modal>
        {/* -------------------- ai cut modal --------------------------------------------------- */}
        {showAI && (
          <Modal
            open={aiCutModalOpen}
            title={t('ai.cut.title')}
            footer={null}
            okText={aiCutServiceRef.current.isRunning ? t('common.close') : t('common.open')}
            cancelText={t('common.cancel')}
            onCancel={saveAICutServiceSettings}
          >
            <AICutAnalysisSettingsPanel
              space={space}
              spaceInfo={spaceInfo}
              aiCutDeps={aiCutDeps}
              setAICutDeps={setAICutDeps}
              extraction={extraction}
              setExtraction={setExtraction}
              cutFreq={cutFreq}
              setCutFreq={setCutFreq}
              cutBlur={cutBlur}
              setCutBlur={setCutBlur}
              isServiceOpen={isServiceOpen}
              setIsServiceOpen={setIsServiceOpen}
              aiCutOptions={aiCutOptions}
              aiCutOptionsChange={aiCutOptionsChange}
              isManager={isManager}
            ></AICutAnalysisSettingsPanel>
            {/* <Button onClick={checkMyAICutAnalysis}>{t('ai.cut.myAnalysis')}</Button> */}
          </Modal>
        )}
        {/* ------------------ work ----------------------------------------------------- */}
        {space && showAI && (
          <WorkModal
            space={space}
            spaceInfo={spaceInfo}
            open={workModalOpen}
            setOpen={setWorkModalOpen}
            isStartWork={workEnabled}
            setIsStartWork={setWorkEnabled}
            isUseAI={isUseAI}
            setIsUseAI={setIsUseAI}
            isSync={isSync}
            setIsSync={setIsSync}
            videoBlur={videoBlur}
            setVideoBlur={setVideoBlur}
            screenBlur={screenBlur}
            setScreenBlur={setScreenBlur}
            handleWorkMode={handleWorkMode}
            updateSettings={updateSettings}
          ></WorkModal>
        )}
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
