'use client';

import { ControlType, type WsControlParticipant } from '@/lib/std/device';

import { useControlsChat, useControlsRecord, useControlsSettings } from '@/app/pages/controls/hooks/index';
import { useAICutAnalysisSettings } from '@/app/pages/controls/widgets/ai';
import { useWork } from '@/app/pages/controls/widgets/work';
import { ControlBarExport } from '@/features/controls/shared';
import { api } from '@/lib/api';
import { usePlatformUserInfo } from '@/lib/hooks/platform';
import { socket } from '@/lib/realtime/socket';
import { isSpaceManager } from '@/lib/std';
import { WsBase } from '@/lib/std/device';
import { useRoomStore, useUserStore } from '@/lib/store';
import { Participant } from 'livekit-client';
import * as React from 'react';
import type { useControlsMedia } from './useControlsMedia';
export function useControlsPanels(context: ReturnType<typeof useControlsMedia>) {
  const {
    updateSettings,
    spaceInfo,
    updateRecord,
    setOpenApp,
    startOrStopAICutAnalysis,
    openAIServiceAskNote,
    downloadAIMdReport,
    ref,
    isChatOpen,
    setAICutModalOpen,
    isScreenShareEnabled,
    messageApi,
    saveUsername,
    space,
  } = context;
  const { showAI } = usePlatformUserInfo({
    space,
    uid: space?.localParticipant.identity,
    onEnterRoom: () => {
      socket.emit('update_user_status', {
        space: space!.name,
      } as WsBase);
    },
  });
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
  }, [spaceInfo, space?.localParticipant.identity]);
  const uState = useUserStore();
  const { settingVis, setSettingVis, key, setKey, settingsRef, closeSetting, openSettings } =
    useControlsSettings({ space, saveUsername, updateSettings });
  const {
    openRecordModal,
    setOpenRecordModal,
    isDownload,
    setIsDownload,
    isRecording,
    onClickRecord,
    recordModalOnOk,
    recordModalOnCancel,
  } = useControlsRecord({ space, isManager, spaceInfo, updateRecord });
  const { chatOpen, setChatOpen } = useControlsChat();
  const onClickApp = async () => {
    if (!space) return;
    useRoomStore.getState().setRemoteApp({
      participantId: space.localParticipant.identity,
      participantName: space.localParticipant.name,
      auth: 'write',
    });
    setOpenApp(true);
  };
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
  const inviteUrl = typeof window === 'undefined' ? '' : window.location.href;
  const { inviteTextRef, t } = context;
  const changeParticipantName = () => {
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
  };
  const copyInvite = async () => {
    await navigator.clipboard.writeText(
      inviteTextRef.current?.innerText ||
      `${t('more.participant.invite.link')}: ${inviteUrl}`,
    );
    setOpenShareModal(false);
  };
  return {
    inviteUrl,
    copyInvite,
    changeParticipantName,
    ...context,
    showAI,
    openMore,
    setOpenMore,
    moreType,
    setMoreType,
    openShareModal,
    setOpenShareModal,
    selectedParticipant,
    setSelectedParticipant,
    username,
    setUsername,
    openNameModal,
    setOpenNameModal,
    remoteApp,
    participantList,
    isManager,
    uState,
    settingVis,
    setSettingVis,
    key,
    setKey,
    settingsRef,
    closeSetting,
    openSettings,
    openRecordModal,
    setOpenRecordModal,
    isDownload,
    setIsDownload,
    isRecording,
    onClickRecord,
    recordModalOnOk,
    recordModalOnCancel,
    chatOpen,
    setChatOpen,
    onClickApp,
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
    onClickAI,
    saveAICutServiceSettings,
    workModalOpen,
    setWorkModalOpen,
    workEnabled,
    setWorkEnabled,
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
  };
}
