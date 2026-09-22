import { chatMessageKey, mergeChatMessages } from '@/components/Chat/message-key';
import { api } from '@/lib/api';
import { socket } from '@/lib/realtime/socket';
import { markExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import { ChatMsgItem } from '@/lib/std/chat';
import {
  WsBase
} from '@/lib/std/device';
import { analyzeLicense, getLicensePersonLimit, validLicenseDomain } from '@/lib/std/license';
import { useLicenseStore, useRoomStore } from '@/lib/store';
import {
  ConnectionState
} from 'livekit-client';
import {
  useEffect,
  useRef
} from 'react';
import type { useConferenceState } from './useConferenceState';
export function useConferenceInitialization(context: ReturnType<typeof useConferenceState>) {
  const latest = useRef(context); latest.current = context;
  const { space, init } = context;
  useEffect(() => {
    if (!space || space.state !== ConnectionState.Connected || !init) return;
    let cancelled = false;
    const {
      messageApi,
      config,
      setInit,
      t,
      uState,
      uLicenseState,
      controlsRef,
      settings,
      updateSettings,
      fromVocespace,
      platUser,
      roomEnter,
      setNoteStateForAICutService,
      fetchPlatformData,
    } = latest.current;
    const syncSettings = async () => {
      const todos = await fetchPlatformData(fromVocespace);
      if (cancelled) return;
      // 将当前参与者的基础设置发送到服务器 ----------------------------------------------------------
      await updateSettings(
        {
          ...uState,
          socketId: socket.id,
          name: space.localParticipant.name || space.localParticipant.identity,
          startAt: new Date().getTime(),
          online: true,
          ...(todos ? { appDatas: { ...uState.appDatas, todo: todos } } : uState.appDatas),
          auth: platUser
            ? {
              platform: platUser.auth,
              identity: platUser.identity,
            }
            : undefined,
        },
        undefined,
        true,
      );
      // 如果是platform用户，有可能是需要直接进入某个子房间的 ------------------------------------------
      // 详细见usePlatformUserInfo中对于roomEnter的处理
      await roomEnter();
    };
    const fetchChatMsg = async () => {
      const response = await api.getChatMsg(space.name);
      if (response.ok) {
        const { msgs }: { msgs: ChatMsgItem[] } = await response.json();
        if (cancelled) return;
        useRoomStore.getState().setChatMsg((previous) => {
          const known = new Set(previous.msgs.map(chatMessageKey));
          const unread = msgs.filter(message => message.sender.id !== space.localParticipant.identity && !known.has(chatMessageKey(message))).length;
          return { msgs: mergeChatMessages(previous.msgs, msgs), unhandled: controlsRef.current?.isChatOpen ? 0 : previous.unhandled + unread };
        });
      } else {
        console.error('Failed to fetch chat messages:', response.statusText);
      }
    };
    const validLicense = async () => {
      if (!uLicenseState.space.isAnalysis) {
        const license = analyzeLicense(config.license, (_e) => {
          messageApi.error({
            content: t('settings.license.invalid') + t('settings.license.default_license'),
            duration: 8,
          });
        });
        if (!validLicenseDomain(license.domains, config.serverUrl)) {
          messageApi.error(t('settings.license.invalid_domain'));
          markExplicitLeaveIntent();
          void space.disconnect(true);
          return false;
        }

        useLicenseStore.setState({
          space: {
            ...license,
            isAnalysis: true,
            personLimit: getLicensePersonLimit(license.limit, license.isTmp),
          },
        });
      }
      return true;
    };
    void (async () => {
      try {
        setNoteStateForAICutService({ openAIService: false, noteClosed: false, hasAsked: false });
        const allowed = await validLicense();
        if (!allowed || cancelled) return;
        await Promise.all([fetchChatMsg(), syncSettings()]);
        if (!cancelled) socket.emit('update_user_status', { space: space.name } as WsBase);
      } catch (error) { if (!cancelled) { console.error('Room initialization failed', error); messageApi.error(t('common.try_again')); } }
      finally { if (!cancelled) setInit(false); }
    })();
    return () => { cancelled = true; };
  }, [space, space?.state, init]);
}
