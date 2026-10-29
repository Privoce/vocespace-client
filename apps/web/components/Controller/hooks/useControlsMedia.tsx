'use client';
import { analytics } from '@/lib/analytics';
import type { AnalyticsOperation } from '@vocespace/client-sdk';
import { Track } from 'livekit-client';

import { ControlBarExport, ControlBarProps } from '../types';
import { supportsScreenSharing, useMediaQuery } from './useMediaQuery';
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
  usePersistentUserChoices,
} from '@livekit/components-react';
import { message, notification } from 'antd';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import * as React from 'react';
export function useControlsMedia(
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
    openApp,
    setOpenApp,
    toRenameSettings,
    startOrStopAICutAnalysis,
    openAIServiceAskNote,
    downloadAIMdReport,
    config,
    ...props
  }: ControlBarProps,
  ref: React.ForwardedRef<ControlBarExport>,
) {
  const mediaOperations = React.useRef(
    new Map<string, { operation: AnalyticsOperation; expected: boolean }>(),
  );
  const beginMedia = (source: Track.Source) => {
    if (mediaOperations.current.has(source)) return;
    const participant = space?.localParticipant;
    const enabled =
      source === Track.Source.Microphone
        ? participant?.isMicrophoneEnabled
        : source === Track.Source.Camera
          ? participant?.isCameraEnabled
          : participant?.isScreenShareEnabled;
    mediaOperations.current.set(source, {
      expected: !enabled,
      operation: analytics.begin('media_change', {
        source: 'meeting',
        media_type:
          source === Track.Source.Microphone
            ? 'microphone'
            : source === Track.Source.Camera
              ? 'camera'
              : 'screen',
        action: enabled ? 'disable' : 'enable',
      }),
    });
  };
  const finishMedia = React.useCallback(
    (source: Track.Source, error?: unknown, enabled?: boolean) => {
      const pending = mediaOperations.current.get(source);
      if (error) pending?.operation.fail(error);
      else pending?.operation.end(enabled === pending.expected ? 'success' : 'cancelled');
      mediaOperations.current.delete(source);
    },
    [],
  );
  React.useEffect(() => {
    const operations = mediaOperations.current;
    return () => {
      for (const { operation } of operations.values()) operation.end('cancelled');
      operations.clear();
    };
  }, []);
  const trackMedia = async (
    source: Track.Source,
    action: () => Promise<boolean | undefined | void>,
  ) => {
    beginMedia(source);
    try {
      const result = await action();
      if (typeof result === 'boolean') finishMedia(source, undefined, result);
      else {
        mediaOperations.current.get(source)?.operation.end('cancelled');
        mediaOperations.current.delete(source);
      }
      return result;
    } catch (error) {
      finishMedia(source, error);
      throw error;
    }
  };
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
    (enabled: boolean, isUserInitiated = false) => {
      if (isUserInitiated) finishMedia(Track.Source.ScreenShare, undefined, enabled);
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
    [isMobile, isWeChat, noteApi, t, finishMedia],
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
    (enabled: boolean, isUserInitiated: boolean) => {
      if (isUserInitiated) {
        saveAudioInputEnabled(enabled);
        finishMedia(Track.Source.Microphone, undefined, enabled);
      }
    },
    [saveAudioInputEnabled, finishMedia],
  );
  const cameraOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) => {
      if (isUserInitiated) {
        saveVideoInputEnabled(enabled);
        finishMedia(Track.Source.Camera, undefined, enabled);
      }
    },
    [saveVideoInputEnabled, finishMedia],
  );
  return {
    beginMedia,
    trackMedia,
    variation,
    controls,
    saveUserChoices,
    onDeviceError: (value: { source: Track.Source; error: Error }) => {
      finishMedia(value.source, value.error);
      onDeviceError?.(value);
    },
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
