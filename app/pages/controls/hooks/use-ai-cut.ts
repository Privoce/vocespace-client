import { useRef, useState, useCallback, useEffect } from 'react';
import type { Room } from 'livekit-client';
import { api } from '@/lib/api';
import { AICutService } from '@/lib/ai/cut';
import { AICutAnalysisRes, DEFAULT_AI_CUT_ANALYSIS_RES } from '@/lib/ai/analysis';
import { convertPlatformToACARes, PlarformAICutAnalysis, platformAPI, PlatformTodos } from '@/lib/api/platform';
import { AICutParticipantConf, todayTimeStamp } from '@/lib/std/space';
import { usePlatformUserInfoCheap } from '@/lib/hooks/platform';
import { isMobile } from '@/lib/std';
import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import { useI18n } from '@/lib/i18n/i18n';

interface UseAICutServiceOptions {
  space: Room | null | undefined;
  settings: any;
  uState: any;
  messageApi: MessageInstance;
  noteApi: NotificationInstance;
  fromVocespace: boolean;
  updateSettings: (s: any) => Promise<boolean | undefined>;
  locale: string;
}

interface AICutServiceReturn {
  aiCutServiceRef: React.MutableRefObject<AICutService>;
  aiCutAnalysisRes: AICutAnalysisRes;
  setAICutAnalysisRes: (res: AICutAnalysisRes) => void;
  noteStateForAICutService: { openAIService: boolean; noteClosed: boolean; hasAsked: boolean };
  setNoteStateForAICutService: (s: any) => void;
  startOrStopAICutAnalysis: (freq: number, conf: AICutParticipantConf, reload?: boolean) => Promise<void>;
  stopAICutService: (room: Room) => Promise<void>;
  openAIServiceAskNote: () => void;
  reloadResult: () => Promise<void>;
  fetchPlatformData: (isAuth: boolean) => Promise<any[]>;
}

export function useAICutService(options: UseAICutServiceOptions): AICutServiceReturn {
  const { space, settings, uState, messageApi, noteApi, updateSettings, locale } = options;
  const { t } = useI18n();
  const aiCutServiceRef = useRef<AICutService>(new AICutService());
  const aiCutAnalysisIntervalId = useRef<NodeJS.Timeout | null>(null);
  const [aiCutAnalysisRes, setAICutAnalysisRes] = useState<AICutAnalysisRes>(DEFAULT_AI_CUT_ANALYSIS_RES);
  const [noteStateForAICutService, setNoteStateForAICutService] = useState({
    openAIService: false,
    noteClosed: false,
    hasAsked: !settings?.ai?.cut?.enabled || false,
  });

  const reloadResult = useCallback(async () => {
    if (!space) return;
    const response = await api.ai.getAnalysisRes(
      space.name,
      space.localParticipant.identity,
      usePlatformUserInfoCheap({ user: settings.participants[space.localParticipant.identity] }).isAuth,
    );
    if (response.ok) {
      const { res }: { res: AICutAnalysisRes } = await response.json();
      setAICutAnalysisRes(res);
      messageApi.success(t('ai.cut.success.reload'));
    } else {
      messageApi.error(t('ai.cut.error.reload'));
    }
  }, [space, settings, messageApi, t]);

  const stopAICutService = useCallback(async (room: Room) => {
    aiCutServiceRef.current.stop();
    aiCutServiceRef.current.clearScreenshots();
    if (aiCutAnalysisIntervalId.current) {
      clearInterval(aiCutAnalysisIntervalId.current);
      aiCutAnalysisIntervalId.current = null;
    }
    await api.ai.stop(room.name, room.localParticipant.identity);
  }, []);

  const startOrStopAICutAnalysis = useCallback(
    async (freq: number, conf: AICutParticipantConf, reload?: boolean) => {
      if (!space || !space.localParticipant) return;
      if (conf.enabled) {
        await aiCutServiceRef.current.start(
          freq,
          conf.spent,
          space.localParticipant,
          reload,
          async (lastScreenShot) => {
            if (space && space.localParticipant) {
              let todos: string[] = [];
              if (conf.todo) {
                todos =
                  uState.appDatas.todo
                    ?.map((todo: any) => todo.items.filter((item: any) => !item.done))
                    .flat()
                    .map((item: any) => item.title) || [];
              }
              const response = await api.ai.analysis({
                spaceName: space.name,
                userId: space.localParticipant.identity,
                screenShot: lastScreenShot,
                todos,
                freq,
                lang: locale,
                extraction: conf.extraction,
                isAuth: usePlatformUserInfoCheap({ user: uState }).isAuth,
                blur: conf.blur,
              });
              if (!response.ok) {
                messageApi.warning(t('ai.cut.error.start'));
                stopAICutService(space);
                await updateSettings({ ai: { cut: { ...conf, enabled: false } } });
                socket.emit('update_user_status', { space: space.name } as WsBase);
              }
            }
          },
          () => messageApi.success(t('ai.cut.success.start')),
          (e: any) => {
            console.error('Failed to start AI Cut Service:', e);
            messageApi.warning(t('ai.cut.error.start'));
          },
        );
        if (aiCutAnalysisIntervalId.current) {
          try { clearInterval(aiCutAnalysisIntervalId.current as unknown as number); } catch { /* ignore */ }
          aiCutAnalysisIntervalId.current = null;
        }
        aiCutAnalysisIntervalId.current = setInterval(() => { reloadResult(); }, (freq + 2) * 60 * 1000);
      } else {
        stopAICutService(space);
      }
      await updateSettings({ ai: { cut: { ...conf } } });
      socket.emit('update_user_status', { space: space.name } as WsBase);
    },
    [space, uState, messageApi, t, updateSettings, locale, stopAICutService, reloadResult],
  );

  const openAIServiceAskNote = useCallback(() => {
    noteApi.open({
      message: t('ai.cut.ask_permission_title'),
      description: t('ai.cut.ask_permission'),
      duration: 10,
      onClose: () => {
        setNoteStateForAICutService({ openAIService: false, noteClosed: true, hasAsked: true });
      },
    });
  }, [noteApi, t, space]);

  useEffect(() => {
    if (!settings) return;
    if (
      noteStateForAICutService.hasAsked === false &&
      settings.ai.cut.enabled === undefined &&
      !isMobile()
    ) {
      openAIServiceAskNote();
    }
  }, [noteStateForAICutService.hasAsked, settings, openAIServiceAskNote]);

  useEffect(() => {
    if (noteStateForAICutService.noteClosed) {
      startOrStopAICutAnalysis(settings.ai.cut.freq, {
        ...uState.ai.cut,
        enabled: noteStateForAICutService.openAIService,
      });
    }
  }, [noteStateForAICutService.noteClosed, noteStateForAICutService.openAIService]);

  const fetchPlatformData = useCallback(async (isAuth: boolean) => {
    const identity = space?.localParticipant.identity;
    if (!isAuth || !identity) return [];
    const aiResponse = await platformAPI.ai.getAIAnalysis(identity, todayTimeStamp());
    const response = await platformAPI.todo.getTodos(identity);
    if (aiResponse.ok) {
      const { data }: { data: PlarformAICutAnalysis } = await aiResponse.json();
      setAICutAnalysisRes(convertPlatformToACARes(data));
    } else {
      setAICutAnalysisRes(DEFAULT_AI_CUT_ANALYSIS_RES);
    }
    if (response.ok) {
      const { todos }: { todos: PlatformTodos[] } = await response.json();
      return todos.map((todo) => ({ items: todo.items, date: Number(todo.date) }));
    }
    return [];
  }, [space]);

  return {
    aiCutServiceRef,
    aiCutAnalysisRes,
    setAICutAnalysisRes,
    noteStateForAICutService,
    setNoteStateForAICutService,
    startOrStopAICutAnalysis,
    stopAICutService,
    openAIServiceAskNote,
    reloadResult,
    fetchPlatformData,
  };
}
