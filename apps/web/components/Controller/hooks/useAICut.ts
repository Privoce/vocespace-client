import { useRef, useState, useCallback, useEffect } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { api } from '@/lib/api';
import { AICutService } from '@/lib/ai/cut';
import { AICutAnalysisRes, DEFAULT_AI_CUT_ANALYSIS_RES } from '@/lib/ai/analysis';
import { convertPlatformToACARes, PlarformAICutAnalysis, platformAPI, PlatformTodos } from '@/lib/api/platform';
import { AICutParticipantConf, todayTimeStamp } from '@/lib/std/space';
import { getParticipantPlatformInfo } from '@/lib/hooks/platform';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';
import { socket } from '@/lib/realtime/socket';
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
  const device = useLayoutDevice();
  const aiCutServiceRef = useRef<AICutService>(new AICutService());
  const analysisGeneration = useRef(0);
  const aiCutAnalysisIntervalId = useRef<NodeJS.Timeout | null>(null);
  const [aiCutAnalysisRes, setAICutAnalysisRes] = useState<AICutAnalysisRes>(DEFAULT_AI_CUT_ANALYSIS_RES);
  const [noteStateForAICutService, setNoteStateForAICutService] = useState({
    openAIService: false,
    noteClosed: false,
    hasAsked: !settings?.ai?.cut?.enabled || false,
  });

  const loadAnalysisResult = useCallback(
    async (showMessage: boolean) => {
      if (!space) return false;
      const participant = settings?.participants?.[space.localParticipant.identity];
      const response = await api.ai.getAnalysisRes(
        space.name,
        space.localParticipant.identity,
        getParticipantPlatformInfo({ user: participant }).isAuth,
      );
      if (response.ok) {
        const { res }: { res: AICutAnalysisRes } = await response.json();
        setAICutAnalysisRes(res);
        if (showMessage) {
          messageApi.success(t('ai.cut.success.reload'));
        }
        return true;
      }
      if (showMessage) {
        messageApi.error(t('ai.cut.error.reload'));
      }
      return false;
    },
    [space, settings, messageApi, t],
  );

  const reloadResult = useCallback(async () => {
    await loadAnalysisResult(true);
  }, [loadAnalysisResult]);

  const stopAICutService = useCallback(async (room: Room) => {
    analysisGeneration.current++;
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
        if (!aiCutServiceRef.current.hasScreenShare(space.localParticipant)) {
          messageApi.warning(t('ai.cut.ask_permission'));
          return;
        }
        const generation = ++analysisGeneration.current;
        await aiCutServiceRef.current.start(
          freq,
          conf.spent,
          space.localParticipant,
          reload,
          async (lastScreenShot) => {
            if (generation === analysisGeneration.current && lastScreenShot &&
                aiCutServiceRef.current.hasScreenShare(space.localParticipant)) {
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
                isAuth: getParticipantPlatformInfo({ user: uState }).isAuth,
                blur: conf.blur,
              });
              if (generation !== analysisGeneration.current) return;
              if (!response.ok) {
                const failure = await response.json().catch(() => ({}));
                messageApi.warning(t(failure.code === 'AI_QUOTA_EXHAUSTED'
                  ? 'ai.cut.error.quota' : 'ai.cut.error.analysis'));
                await stopAICutService(space);
                await updateSettings({ ai: { cut: { ...conf, enabled: false } } });
                socket.emit('update_user_status', { space: space.name } as WsBase);
              } else {
                // 自动刷新采用静默模式，避免周期性提示打断用户
                await loadAnalysisResult(false);
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
          try {
            clearInterval(aiCutAnalysisIntervalId.current as unknown as number);
          } catch {
            /* ignore */
          }
          aiCutAnalysisIntervalId.current = null;
        }
        // 按采集频率进行静默兜底拉取，防止页面重连后 UI 不更新
        aiCutAnalysisIntervalId.current = setInterval(
          () => {
            if (aiCutServiceRef.current.isRunning) void loadAnalysisResult(false);
          },
          Math.max(1, freq) * 60 * 1000,
        );
        // 启动后先拉一次最新结果，减少首屏等待
        if (aiCutServiceRef.current.isRunning) void loadAnalysisResult(false);
      } else {
        await stopAICutService(space);
      }
      await updateSettings({ ai: { cut: { ...conf } } });
      socket.emit('update_user_status', { space: space.name } as WsBase);
    },
    [space, uState, messageApi, t, updateSettings, locale, stopAICutService, loadAnalysisResult],
  );


  const stopForScreenLoss = useRef(() => {});
  stopForScreenLoss.current = () => {
    if (!space || !aiCutServiceRef.current.isRunning ||
        aiCutServiceRef.current.hasScreenShare(space.localParticipant)) return;
    void stopAICutService(space).catch(() => {});
    void updateSettings({ ai: { cut: { ...uState.ai.cut, enabled: false } } });
  };
  useEffect(() => {
    if (!space) return;
    const stopIfUnavailable = () => stopForScreenLoss.current();
    const service = aiCutServiceRef.current;
    const generationState = analysisGeneration;
    const disconnect = () => {
      generationState.current++;
      service.stop();
      if (aiCutAnalysisIntervalId.current) clearInterval(aiCutAnalysisIntervalId.current);
      aiCutAnalysisIntervalId.current = null;
    };
    space.on(RoomEvent.Disconnected, disconnect);
    space.on(RoomEvent.LocalTrackUnpublished, stopIfUnavailable);
    space.on(RoomEvent.TrackMuted, stopIfUnavailable);
    return () => {
      space.off(RoomEvent.LocalTrackUnpublished, stopIfUnavailable);
      space.off(RoomEvent.TrackMuted, stopIfUnavailable);
      space.off(RoomEvent.Disconnected, disconnect);
      disconnect();
      service.clearScreenshots();
      if (aiCutAnalysisIntervalId.current) clearInterval(aiCutAnalysisIntervalId.current);
      aiCutAnalysisIntervalId.current = null;
    };
  }, [space]);

  const openAIServiceAskNote = useCallback(() => {
    noteApi.open({
      message: t('ai.cut.ask_permission_title'),
      description: t('ai.cut.ask_permission'),
      duration: 10,
      onClose: () => {
        setNoteStateForAICutService({ openAIService: false, noteClosed: true, hasAsked: true });
      },
    });
  }, [noteApi, t]);

  useEffect(() => {
    if (!settings) return;
    if (
      noteStateForAICutService.hasAsked === false &&
      settings.ai.cut.enabled === undefined &&
      device !== 'phone'
    ) {
      openAIServiceAskNote();
    }
  }, [noteStateForAICutService.hasAsked, settings, openAIServiceAskNote, device]);

  useEffect(() => {
    if (noteStateForAICutService.noteClosed) {
      setNoteStateForAICutService((state) => ({ ...state, noteClosed: false }));
      startOrStopAICutAnalysis(settings.ai.cut.freq, {
        ...uState.ai.cut,
        enabled: noteStateForAICutService.openAIService,
      });
    }
  }, [noteStateForAICutService.noteClosed, noteStateForAICutService.openAIService, settings.ai.cut.freq, startOrStopAICutAnalysis, uState.ai.cut]);

  useEffect(() => {
    if (!space || !settings?.ai?.cut?.enabled) {
      if (aiCutAnalysisIntervalId.current) {
        clearInterval(aiCutAnalysisIntervalId.current);
        aiCutAnalysisIntervalId.current = null;
      }
      return;
    }

    if (aiCutAnalysisIntervalId.current) {
      clearInterval(aiCutAnalysisIntervalId.current);
    }

    const freq = Number(settings?.ai?.cut?.freq || 3);
    aiCutAnalysisIntervalId.current = setInterval(
      () => {
        if (aiCutServiceRef.current.isRunning) void loadAnalysisResult(false);
      },
      Math.max(1, freq) * 60 * 1000,
    );

    return () => {
      if (aiCutAnalysisIntervalId.current) {
        clearInterval(aiCutAnalysisIntervalId.current);
        aiCutAnalysisIntervalId.current = null;
      }
    };
  }, [space, settings?.ai?.cut?.enabled, settings?.ai?.cut?.freq, loadAnalysisResult]);

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
