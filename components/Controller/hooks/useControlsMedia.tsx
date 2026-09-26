'use client';

import { ControlBarExport, ControlBarProps, supportsScreenSharing, useMediaQuery } from '@/features/controls/shared';
import { AICutService } from '@/lib/ai/cut';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import { isWeChatBrowser } from '@/lib/std';
import { DEFAULT_WINDOW_ADJUST_WIDTH } from '@/lib/std/window';
import { useRoomStore } from '@/lib/store';
import {
  useLocalParticipantPermissions,
  useMaybeLayoutContext,
  useMaybeRoomContext,
  usePersistentUserChoices
} from '@livekit/components-react';
import { message, notification } from 'antd';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import * as React from 'react';
export function useControlsMedia({
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
  openApp,
  setOpenApp,
  toRenameSettings,
  startOrStopAICutAnalysis,
  openAIServiceAskNote,
  downloadAIMdReport,
  config,
  ...props
}: ControlBarProps, ref: React.ForwardedRef<ControlBarExport>) {
  const device = useLayoutDevice();
  const { t } = useI18n();
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const layoutContext = useMaybeLayoutContext();
  const inviteTextRef = React.useRef<HTMLDivElement>(null);
  const chatMsg = useRoomStore((s) => s.chatMsg);
  const controlLeftRef = React.useRef<HTMLDivElement>(null);
  const [aiCutModalOpen, setAICutModalOpen] = React.useState(false);
  const aiCutServiceRef = React.useRef<AICutService>(new AICutService());
  const [controlWidth, setControlWidth] = React.useState(
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );
  const isMobile = device === 'phone';
  const isWeChat = React.useMemo(() => isWeChatBrowser(), []);
  const controlSize = React.useMemo(() => {
    return (isMobile ? 'small' : 'middle') as SizeType;
  }, [isMobile]);
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
  }, [device]);
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
  const hasShownWeChatScreenShareNoteRef = React.useRef(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [noteApi, noteHolder] = notification.useNotification();
  const onScreenShareChange = React.useCallback(
    (enabled: boolean) => {
      setIsScreenShareEnabled(enabled);

      if (enabled && isWeChat && !isMobile && !hasShownWeChatScreenShareNoteRef.current) {
        noteApi.info({
          message: t('common.wx.screen_share_note_title'),
          description: t('common.wx.screen_share_note_desc'),
          duration: 8,
        });
        hasShownWeChatScreenShareNoteRef.current = true;
      }
    },
    [isMobile, isWeChat, noteApi, t],
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
  return {
    variation,
    controls,
    saveUserChoices,
    onDeviceError,
    updateSettings,
    setUserStatus,
    spaceInfo,
    fetchSettings,
    updateRecord,
    setPermissionDevice,
    openApp,
    setOpenApp,
    toRenameSettings,
    startOrStopAICutAnalysis,
    openAIServiceAskNote,
    downloadAIMdReport,
    config,
    props,
    ref,
    device,
    t,
    isChatOpen,
    setIsChatOpen,
    layoutContext,
    inviteTextRef,
    chatMsg,
    controlLeftRef,
    aiCutModalOpen,
    setAICutModalOpen,
    aiCutServiceRef,
    controlWidth,
    setControlWidth,
    isMobile,
    isWeChat,
    controlSize,
    isTooLittleSpace,
    defaultVariation,
    visibleControls,
    localPermissions,
    showIcon,
    showText,
    browserSupportsScreenSharing,
    isScreenShareEnabled,
    setIsScreenShareEnabled,
    audioMenuOpen,
    setAudioMenuOpen,
    videoMenuOpen,
    setVideoMenuOpen,
    hasShownWeChatScreenShareNoteRef,
    messageApi,
    contextHolder,
    noteApi,
    noteHolder,
    onScreenShareChange,
    htmlProps,
    userChoices,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
    saveUsername,
    space,
    microphoneOnChange,
    cameraOnChange,
  };
}
