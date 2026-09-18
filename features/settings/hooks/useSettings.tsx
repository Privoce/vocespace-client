'use client';

import { VirtualSettingsExports } from '@/app/pages/controls/settings/virtual';
import { SettingsExports, SettingsProps } from '@/features/settings/shared';
import { api } from '@/lib/api';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import { RecordData, RecordResponse, useRecordingEnv } from '@/lib/std/recording';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import { useUserStore } from '@/lib/store';
import * as React from 'react';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ulid } from 'ulid';

export function useSettings({
  close,
  username: uname,
  tab: { key, setKey },
  updateSettings,
  messageApi,
  space,
  localParticipant,
  spaceInfo,
  showAI,
}: SettingsProps, ref: React.ForwardedRef<SettingsExports>) {
  const device = useLayoutDevice();
  const { t } = useI18n();
  const [username, setUsername] = useState(uname);
  const [appendStatus, setAppendStatus] = useState(false);
  const uState = useUserStore();
  const [volume, setVolume] = useState(uState.volume);
  const [videoBlur, setVideoBlur] = useState(uState.blur);
  const [screenBlur, setScreenBlur] = useState(uState.screenBlur);
  const [virtualEnabled, setVirtualEnabled] = useState(false);
  const [modelRole, setModelRole] = useState<ModelRole>(ModelRole.None);
  const [modelBg, setModelBg] = useState<ModelBg>(ModelBg.ClassRoom);
  const [openShareAudio, setOpenShareAudio] = useState<boolean>(uState.openShareAudio);
  const [openPromptSound, setOpenPromptSound] = useState<boolean>(uState.openPromptSound);
  const [noiseSuppression, setNoiseSuppression] = useState(uState.audioProcessing?.noiseSuppression ?? true);
  const [echoCancellation, setEchoCancellation] = useState(uState.audioProcessing?.echoCancellation ?? true);
  const [autoGainControl, setAutoGainControl] = useState(uState.audioProcessing?.autoGainControl ?? true);
  const [compare, setCompare] = useState(false);
  const virtualSettingsRef = useRef<VirtualSettingsExports>(null);
  const { env, state, isConnected } = useRecordingEnv(messageApi);
  const [recordsData, setRecordsData] = useState<RecordData[]>([]);
  const [phonePanelOpen, setPhonePanelOpen] = useState(key !== 'general');
  const [firstOpen, setFirstOpen] = useState(true);
  const searchRoomRecords = async () => {
    try {
      const response = await api.getS3Records(space.name);
      if (response.ok) {
        const { records, success }: RecordResponse = await response.json();
        if (success) {
          setRecordsData(records.map(record => ({ ...record, id: ulid() })));
          if (records.length) messageApi.success(t('recording.search.success'));
          return;
        }
      }
      setRecordsData([]);
      messageApi.error(t('recording.search.error'));
    } catch { messageApi.error(t('recording.search.error')); }
  };
  useEffect(() => { if (appendStatus) setPhonePanelOpen(true); }, [appendStatus]);
  useEffect(() => { if (key !== 'general') setPhonePanelOpen(true); }, [key]);
  const selectPanel = (panel: string) => {
    setKey(panel as import('../shared').TabKey);
    setPhonePanelOpen(true);
    if (panel === 'recording' && firstOpen) { void searchRoomRecords(); setFirstOpen(false); }
  };
  useImperativeHandle(ref, () => ({
    username,
    removeVideo: () => {
      if (virtualSettingsRef.current) {
        virtualSettingsRef.current.removeVideo();
        setCompare(false);
      }
    },
    startVideo: async () => {
      if (virtualSettingsRef.current) {
        await virtualSettingsRef.current.startVideo();
      }
    },
    setAppendStatus,
    state: {
      volume,
      blur: videoBlur,
      screenBlur,
      virtual: {
        enabled: virtualEnabled,
        role: modelRole,
        bg: modelBg,
      },
      openShareAudio,
      openPromptSound,
      audioProcessing: {
        noiseSuppression,
        echoCancellation,
        autoGainControl,
      },
    },
  }));
  return {
    phonePanelOpen,
    setPhonePanelOpen,
    selectPanel,
    close,
    uname,
    key,
    setKey,
    updateSettings,
    messageApi,
    space,
    localParticipant,
    spaceInfo,
    showAI,
    ref,
    t,
    username,
    setUsername,
    appendStatus,
    setAppendStatus,
    uState,
    volume,
    setVolume,
    videoBlur,
    setVideoBlur,
    screenBlur,
    setScreenBlur,
    virtualEnabled,
    setVirtualEnabled,
    modelRole,
    setModelRole,
    modelBg,
    setModelBg,
    openShareAudio,
    setOpenShareAudio,
    openPromptSound,
    setOpenPromptSound,
    noiseSuppression,
    setNoiseSuppression,
    echoCancellation,
    setEchoCancellation,
    autoGainControl,
    setAutoGainControl,
    compare,
    setCompare,
    virtualSettingsRef,
    env,
    state,
    isConnected,
    recordsData,
    setRecordsData,
    firstOpen,
    setFirstOpen,
    searchRoomRecords,
    device,
  };
}
