'use client';

import { AICutAnalysisMdTabsExports } from '@/app/pages/apps/ai_analysis_md';
import { FlotAppExports, FlotLayoutExports, FlotLayoutProps } from '@/features/widgets/shared';
import { AICutAnalysisRes, DEFAULT_AI_CUT_ANALYSIS_RES } from '@/lib/ai/analysis';
import { api } from '@/lib/api';
import {
  convertPlatformToACARes,
  PlarformAICutAnalysis,
  platformAPI,
  PlatformTodos,
} from '@/lib/api/platform';
import { getParticipantPlatformInfo } from '@/lib/hooks/platform';
import { useLatestCallback } from '@/lib/hooks/use-latest-callback';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { socket } from '@/lib/realtime/socket';
import { WsBase } from '@/lib/std/device';
import {
  sortTodos,
  SpaceTodo,
  todayTimeStamp
} from '@/lib/std/space';
import { useRoomStore } from '@/lib/store';
import { useLocalParticipant } from '@livekit/components-react';
import * as React from 'react';
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

export function useWidgets({
  messageApi,
  openApp,
  spaceInfo,
  space,
  setOpenApp,
  showAICutAnalysisSettings,
  reloadResult,
  startOrStopAICutAnalysis,
  openAIServiceAskNote,
  aiCutAnalysisRes,
  cutInstance,
  updateSettings,
  showAI,
}: FlotLayoutProps, ref: React.ForwardedRef<FlotLayoutExports>) {
  const device = useLayoutDevice();
  const flotAppItemRef = useRef<FlotAppExports>(null);
  const AICutAnalysisMdTabsRef = useRef<AICutAnalysisMdTabsExports>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const { localParticipant } = useLocalParticipant();
  const targetParticipant = useRoomStore((s) => s.remoteApp);
  const [fetchData, setFetchData] = useState<boolean>(false);
  const isSelf = useMemo(() => {
    return localParticipant.identity === (targetParticipant.participantId || localParticipant.identity);
  }, [localParticipant.identity, targetParticipant.participantId]);
  const [remoteAnalysisRes, setRemoteAnalysisRes] = useState<AICutAnalysisRes>(
    DEFAULT_AI_CUT_ANALYSIS_RES,
  );
  const layoutType = { span1: showAI ? 16 : 0, span2: showAI ? 8 : 24, ty: device === 'phone' ? 'phone' : 'desktop' };
  const [phonePanel, setPhonePanel] = useState<'apps' | 'ai'>('apps');
  const isAuthed = getParticipantPlatformInfo({ user: spaceInfo.participants[targetParticipant.participantId || localParticipant.identity] }).isAuth;

  const getRemoteAICutAnalysisRes = useLatestCallback(async (participantId: string) => {
    if (participantId && !isSelf) {
      // 发起请求获取结果
      if (
        targetParticipant.participantId &&
        getParticipantPlatformInfo({
          user: spaceInfo.participants[targetParticipant.participantId],
        }).isAuth
      ) {
        // 如果是认证用户则从平台获取
        const aiResponse = await platformAPI.ai.getAIAnalysis(
          targetParticipant.participantId,
          todayTimeStamp(),
        );
        if (aiResponse.ok) {
          const { data }: { data: PlarformAICutAnalysis } = await aiResponse.json();
          return convertPlatformToACARes(data);
        }
      } else {
        const response = await api.ai.getAnalysisRes(
          space,
          participantId,
          getParticipantPlatformInfo({ user: spaceInfo.participants[participantId] }).isAuth,
        );
        if (response.ok) {
          const { res }: { res: AICutAnalysisRes } = await response.json();
          return res;
        }
      }
    }
    return DEFAULT_AI_CUT_ANALYSIS_RES;
  });
  useEffect(() => {
    let cancelled = false;
    if (
      !isSelf &&
      targetParticipant.participantId &&
      getParticipantPlatformInfo({ user: spaceInfo.participants[targetParticipant.participantId] })
        .isAuth
    ) {
      // console.warn('Fetching remote AI Cut Analysis Result for', targetParticipant.participantId);
      getRemoteAICutAnalysisRes(targetParticipant.participantId).then((res) => {
        if (!cancelled) setRemoteAnalysisRes(res);
      }).catch(error => console.error('Remote analysis failed', error));
    }
    return () => { cancelled = true; };
  }, [isSelf, targetParticipant.participantId, spaceInfo.participants, getRemoteAICutAnalysisRes]);
  const toPersonalPlatform = () => {
    let id = targetParticipant.participantId || localParticipant.identity;
    if (getParticipantPlatformInfo({ user: spaceInfo.participants[id] }).isAuth) {
      let url = `https://home.vocespace.com/ai/${id}`;
      window.open(url, '_blank');
    }
  };
  const fetchTodo = useLatestCallback(async (participantId: string) => {
    // 当前只先请求TODO数据
    const response = await platformAPI.todo.getTodos(participantId);
    if (response.ok) {
      const { todos }: { todos: PlatformTodos[] } = await response.json();
      const items: SpaceTodo[] = todos.map((todo) => {
        return {
          items: todo.items,
          date: Number(todo.date),
        };
      });
      let appDatas = spaceInfo.participants[participantId]?.appDatas || {};
      appDatas = {
        ...appDatas,
        todo: sortTodos(items),
      };
      // 只有自己才需要更新
      if (participantId === localParticipant.identity) {
        await updateSettings({
          appDatas,
        });
      }
      socket.emit('update_user_status', {
        space: space,
      } as WsBase);
    }
  });
  useEffect(() => {
    if (
      targetParticipant.participantId &&
      getParticipantPlatformInfo({ user: spaceInfo.participants[targetParticipant.participantId] })
        .isAuth &&
      fetchData
    ) {
      setFetchData(false);
      void fetchTodo(targetParticipant.participantId).catch(error => console.error('Widget todos failed', error));
    }
  }, [spaceInfo.participants, targetParticipant.participantId, fetchData, fetchTodo]);
  useEffect(() => {
    if (openApp) {
      setFetchData(true);
    }
  }, [openApp]);
  useImperativeHandle(ref, () => ({
    downloadAIMdReport: async () => { await AICutAnalysisMdTabsRef.current?.downloadMdReport?.(); },
  }));
  return {
    phonePanel,
    setPhonePanel,
    isAuthed,
    messageApi,
    openApp,
    spaceInfo,
    space,
    setOpenApp,
    showAICutAnalysisSettings,
    reloadResult,
    startOrStopAICutAnalysis,
    openAIServiceAskNote,
    aiCutAnalysisRes,
    cutInstance,
    updateSettings,
    showAI,
    ref,
    flotAppItemRef,
    AICutAnalysisMdTabsRef,
    containerHeight,
    setContainerHeight,
    localParticipant,
    targetParticipant,
    fetchData,
    setFetchData,
    isSelf,
    remoteAnalysisRes,
    setRemoteAnalysisRes,
    layoutType,
    getRemoteAICutAnalysisRes,
    toPersonalPlatform,
    fetchTodo,
    device,
  };
}
