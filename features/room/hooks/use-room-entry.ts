'use client';

import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';
import { DEFAULT_VOCESPACE_CONFIG,type ReadableConf } from '@/lib/std/conf';
import { PARTICIPANT_SETTINGS_KEY,VOCESPACE_PLATFORM_USER,type ParticipantSettings } from '@/lib/std/space';
import { useUserStore } from '@/lib/store/user';
import type { ConnectionDetails } from '@/lib/types';
import { usePersistentUserChoices,type LocalUserChoices } from '@livekit/components-react';
import { notification } from 'antd';
import { useRouter } from 'next/navigation';
import { useCallback,useEffect,useRef,useState } from 'react';
import type { PageClientImplProps } from '../types';

const preJoinDefaults = { username: '', videoEnabled: true, audioEnabled: true };

import { roomUrlAfterLogin } from '../navigation';

export function useRoomEntry({ spaceName, region, auth, data, details, messageApi }: PageClientImplProps) {
  const { t } = useI18n();
  const [notApi, notHolder] = notification.useNotification();
  const router = useRouter();
  const [preJoinChoices, setPreJoinChoices] = useState<LocalUserChoices>();
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails>();
  const [config, setConfig] = useState<ReadableConf>(DEFAULT_VOCESPACE_CONFIG);
  const [configReady, setConfigReady] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);
  const active = useRef(false);
  const joining = useRef(false);
  const { userChoices } = usePersistentUserChoices({
    defaults: { videoEnabled: false, audioEnabled: false },
    preventSave: false, preventLoad: false,
  });

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setConfigError(false);
    api.getConf().then(async (response) => {
      if (!response.ok) throw new Error(`Configuration HTTP ${response.status}`);
      const value: ReadableConf = await response.json();
      if (!cancelled) { setConfig(value); setConfigReady(true); }
    }).catch((error) => {
      if (!cancelled) { console.error(error); setConfigError(true); }
    });
    return () => { cancelled = true; };
  }, [configAttempt]);

  const handlePreJoinSubmit = useCallback(async (choices: LocalUserChoices) => {
    if (joining.current || !active.current) return;
    joining.current = true;
    try {
      let connection = details as ConnectionDetails | undefined;
      if (!connection) {
        const response = await api.joinSpace(spaceName, choices.username, region, data?.id);
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || `Join HTTP ${response.status}`);
        }
        connection = await response.json();
      }
      if (!active.current) return;
      setPreJoinChoices(choices);
      setConnectionDetails(connection);
      if (auth) router.replace(roomUrlAfterLogin(spaceName, window.location.href));
    } finally {
      joining.current = false;
    }
  }, [auth, data?.id, region, spaceName, details, router]);

  useEffect(() => {
    if (!data || !details) return;
    if (!data.preJoin) {
      setPreJoinChoices({ username: data.username, videoEnabled: false, audioEnabled: false,
        videoDeviceId: '', audioDeviceId: '' });
      setConnectionDetails(details as ConnectionDetails);
    }
    if (auth) router.replace(roomUrlAfterLogin(spaceName, window.location.href));
  }, [data, details, auth, router, spaceName]);

  // The refs let the reload timer use the latest platform identity/choices.
  const latest = useRef({ handlePreJoinSubmit, userChoices, messageApi, t });
  latest.current = { handlePreJoinSubmit, userChoices, messageApi, t };
  useEffect(() => {
    const stored = localStorage.getItem(PARTICIPANT_SETTINGS_KEY);
    if (stored) {
      let settings: ParticipantSettings | undefined;
      try { settings = JSON.parse(stored); } catch { /* Discard corrupt preferences. */ }
      if (settings?.version === '0.5.5') useUserStore.setState(settings);
      else {
        localStorage.removeItem(PARTICIPANT_SETTINGS_KEY);
        localStorage.removeItem(VOCESPACE_PLATFORM_USER);
      }
    }
    if (!localStorage.getItem('reload')) return;
    localStorage.setItem(PARTICIPANT_SETTINGS_KEY, JSON.stringify(useUserStore.getState()));
    latest.current.messageApi.loading(latest.current.t('settings.general.conf.reloading'));
    const timer = setTimeout(async () => {
      localStorage.removeItem('reload');
      try {
        await latest.current.handlePreJoinSubmit({ username: latest.current.userChoices.username,
          videoEnabled: false, audioEnabled: false, videoDeviceId: '', audioDeviceId: '' });
      } catch (error) {
        if (active.current) latest.current.messageApi.error(latest.current.t('msg.error.room.unexpect'));
        console.error(error);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handlePreJoinError = useCallback((error: Error) => console.error(error), []);
  return { t, notApi, notHolder, connectionDetails, preJoinChoices, preJoinDefaults,
    handlePreJoinSubmit, handlePreJoinError, config, configReady, configError,
    retryConfig: () => setConfigAttempt((attempt) => attempt + 1) };
}
