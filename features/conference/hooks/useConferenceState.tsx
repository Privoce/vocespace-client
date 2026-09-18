'use client';

import { FlotLayoutExports } from '@/app/pages/apps/flot';
import { ControlBarExport } from '@/app/pages/controls/bar';
import { ChannelExports } from '@/app/pages/controls/channel';
import { useControlsChat } from '@/app/pages/controls/hooks';
import { useRoomLicense } from '@/app/pages/controls/hooks/index';
import { useAICutService } from '@/app/pages/controls/hooks/use-ai-cut';
import { VideoContainerExports, VideoContainerProps } from '@/features/conference/shared';
import { exportRBAC, usePlatformUserInfo } from '@/lib/hooks/platform';
import { useSpaceInfo } from '@/lib/hooks/space';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import { socket } from '@/lib/realtime/socket';
import {
  WsBase
} from '@/lib/std/device';
import { AppAuth } from '@/lib/std/space';
import { useLicenseStore, useRoomStore, useSpaceStore, useUserStore } from '@/lib/store';
import {
  useCreateLayoutContext,
  useMaybeRoomContext,
  WidgetState
} from '@livekit/components-react';
import React, {
  useMemo,
  useRef,
  useState
} from 'react';
export function useConferenceState({
  chatMessageFormatter,
  chatMessageDecoder,
  chatMessageEncoder,
  SettingsComponent,
  noteApi,
  messageApi,
  setPermissionDevice,
  config,
  ...props
}: VideoContainerProps, ref: React.ForwardedRef<VideoContainerExports>) {
  const device = useLayoutDevice();
  const layoutContext = useCreateLayoutContext();
  const space = useMaybeRoomContext();
  const FlotLayoutRef = useRef<FlotLayoutExports>(null);
  const [init, setInit] = useState(true);
  const { t, locale } = useI18n();
  const isFullScreen = useSpaceStore((s) => s.isFullScreen);
  const setIsFullScreen = useSpaceStore((s) => s.setIsFullScreen);
  const isFocus = useSpaceStore((s) => s.isFocus);
  const setIsFocus = useSpaceStore((s) => s.setIsFocus);
  const uState = useUserStore();
  const collapsed = useSpaceStore((s) => s.collapsed);
  const deviceType: 'mobile' | 'desktop' = device === 'phone' ? 'mobile' : 'desktop';
  const uLicenseState = useLicenseStore();
  const { hasRoomLicense, toBuyRoomLicense } = useRoomLicense(config, space, messageApi);
  const controlsRef = React.useRef<ControlBarExport>(null);
  const waveAudioRef = React.useRef<HTMLAudioElement>(null);
  const promptSoundRef = React.useRef<HTMLAudioElement>(null);
  const [freshPermission, setFreshPermission] = useState(false);
  const [localTrackVersion, setLocalTrackVersion] = useState(0);
  const [cacheWidgetState, setCacheWidgetState] = useState<WidgetState>();
  const chatMsg = useRoomStore((s) => s.chatMsg);
  const { chatOpen, setChatOpen, sendFileConfirm } = useControlsChat();
  const channelRef = React.useRef<ChannelExports>(null);
  const {
    settings,
    updateSettings,
    fetchSettings,
    clearSettings,
    transOrSetOwnerManager,
    updateRecord,
  } = useSpaceInfo(
    space?.name || '', // 房间 ID
    space?.localParticipant?.identity || '', // 参与者 ID
  );
  const { fromVocespace, platUser, roomEnter, showAI } = usePlatformUserInfo({
    space,
    uid: space?.localParticipant.identity,
    onEnterRoom: () => {
      socket.emit('update_user_status', {
        space: space!.name,
      } as WsBase);
    },
  });
  const showSideChannel = useMemo(() => {
    if (!space) return false;
    return exportRBAC(space?.localParticipant.identity, settings).viewRoom;
  }, [space, settings]);
  const [openApp, setOpenApp] = useState<boolean>(false);
  const isActive = true;
  const showFlotApp = (id?: string, participantName?: string, auth?: AppAuth) => {
    useRoomStore.getState().setRemoteApp({
      participantId: id,
      participantName,
      auth: auth || 'read',
    });
    setOpenApp(!openApp);
  };
  const {
    aiCutServiceRef,
    aiCutAnalysisRes,
    noteStateForAICutService,
    setNoteStateForAICutService,
    startOrStopAICutAnalysis,
    stopAICutService,
    openAIServiceAskNote,
    reloadResult,
    fetchPlatformData,
  } = useAICutService({
    space,
    settings,
    uState,
    messageApi,
    noteApi,
    fromVocespace,
    updateSettings,
    locale,
  });
  return {
    layoutContext,
    chatMessageFormatter,
    chatMessageDecoder,
    chatMessageEncoder,
    SettingsComponent,
    noteApi,
    messageApi,
    setPermissionDevice,
    config,
    props,
    ref,
    space,
    FlotLayoutRef,
    init,
    setInit,
    t,
    locale,
    isFullScreen,
    setIsFullScreen,
    isFocus,
    setIsFocus,
    uState,
    collapsed,
    deviceType,
    uLicenseState,
    hasRoomLicense,
    toBuyRoomLicense,
    controlsRef,
    waveAudioRef,
    promptSoundRef,
    freshPermission,
    setFreshPermission,
    localTrackVersion,
    setLocalTrackVersion,
    cacheWidgetState,
    setCacheWidgetState,
    chatMsg,
    chatOpen,
    setChatOpen,
    sendFileConfirm,
    channelRef,
    settings,
    updateSettings,
    fetchSettings,
    clearSettings,
    transOrSetOwnerManager,
    updateRecord,
    fromVocespace,
    platUser,
    roomEnter,
    showAI,
    showSideChannel,
    openApp,
    setOpenApp,
    isActive,
    showFlotApp,
    aiCutServiceRef,
    aiCutAnalysisRes,
    noteStateForAICutService,
    setNoteStateForAICutService,
    startOrStopAICutAnalysis,
    stopAICutService,
    openAIServiceAskNote,
    reloadResult,
    fetchPlatformData,
    device,
  };
}
