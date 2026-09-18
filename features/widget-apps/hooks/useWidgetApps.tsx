'use client';

import { DEFAULT_KEYS, FlotAppExports, FlotAppItemProps, TodoProp } from '@/features/widget-apps/shared';
import { api } from '@/lib/api';
import { getParticipantPlatformInfo } from '@/lib/hooks/platform';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import { socket } from '@/lib/realtime/socket';
import { WsBase } from '@/lib/std/device';
import {
  AppAuth,
  AppKey, castCountdown, castTimer, Countdown, DEFAULT_COUNTDOWN, DEFAULT_TIMER, sortTodos, SpaceCountdown,
  SpaceTimer,
  SpaceTodo,
  Timer
} from '@/lib/std/space';
import { theme } from 'antd';
import * as React from 'react';
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { CountdownProp, TimerProp } from '../shared';

export function useWidgetApps({ messageApi, apps, space, spaceInfo, onHeightChange, isSelf, participantId }: FlotAppItemProps, ref: React.ForwardedRef<FlotAppExports>) {
  const device = useLayoutDevice();
  const [activeKeys, setActiveKeys] = useState<(AppKey | 'together')[]>(DEFAULT_KEYS);
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [showExport, setShowExport] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    if (containerRef.current && onHeightChange) {
      const updateHeight = () => {
        if (containerRef.current) {
          const height = containerRef.current.clientHeight;
          onHeightChange(height);
        }
      };

      // 初始设置高度
      updateHeight();

      // 设置 ResizeObserver
      resizeObserverRef.current = new ResizeObserver(() => {
        updateHeight();
      });

      resizeObserverRef.current.observe(containerRef.current);

      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }
      };
    }
  }, [onHeightChange]);
  const itemStyle: React.CSSProperties = {
    marginBottom: 8,
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusSM,
    border: 'none',
  };
  const appData = useMemo(() => {
    return spaceInfo.participants[participantId]?.appDatas || {};
  }, [spaceInfo, participantId]);
  const upload = async (key: AppKey, data: SpaceTimer | SpaceCountdown | SpaceTodo) => {
    const response = await api.uploadSpaceApp(
      space,
      participantId,
      key,
      data,
      getParticipantPlatformInfo({ user: spaceInfo.participants[participantId] }).isAuth,
    );
    if (response.ok) {
      socket.emit('update_user_status', {
        space,
      } as WsBase);
      messageApi.success(t('more.app.upload.success'));
    } else {
      messageApi.error(t('more.app.upload.error'));
    }
  };
  const setSelfTimerData = async (timer: Timer) => {
    await upload('timer', {
      ...timer,
      timestamp: Date.now(),
    } as SpaceTimer);
  };
  const setRemoteTimerData = async (auth: AppAuth, participantId: string, timer: Timer) => {
    if (auth !== 'write') return;
    await upload('timer', { ...timer, timestamp: Date.now() });
  };
  const setSelfCountdownData = async (countdown: Countdown) => {
    await upload('countdown', {
      ...countdown,
      timestamp: Date.now(),
    } as SpaceCountdown);
  };
  const setSelfTodoData = async (todo: SpaceTodo) => {
    await upload('todo', todo);
  };
  const updateAppSync = async (key: AppKey) => {
    const response = await api.updateSpaceAppSync(space, participantId, key);
    if (response.ok) {
      socket.emit('update_user_status', {
        space,
      } as WsBase);
      messageApi.success(t('more.app.settings.sync.update.success'));
    } else {
      messageApi.error(t('more.app.settings.sync.update.error'));
    }
  };
  const exportTodo = (dataLength: number) => {
    if (dataLength === 0) {
      messageApi.info(t('more.app.todo.unexport'));
    } else {
      setShowExport(true);
    }
  };
  const getTodoText = (todo: TodoProp) => {
    return todo.data
      .map((item) => {
        return `--- ${new Date(item.date).toLocaleDateString()} ---\n${item.items
          .map((item, index) => `- [${item.done ? 'x' : ' '}] ${index + 1}. ${item.title}`)
          .join('\n')}
      `;
      })
      .join('\n\n');
  };
  useImperativeHandle(ref, () => ({
    clientHeight: containerRef.current?.clientHeight,
  }));
  const widgetData = (() => {
    if (!spaceInfo) return {};
    const participant = spaceInfo.participants[participantId];
    if (!participant) return {};
    let timer: TimerProp | undefined = undefined;
    let countdown: CountdownProp | undefined = undefined;
    let todo: TodoProp | undefined = undefined;
    if (isSelf) {
      if (apps.includes('timer')) {
        timer = {
          data: castTimer(appData.timer) || DEFAULT_TIMER,
          setData: setSelfTimerData,
          auth: 'write',
        };
      }
      if (apps.includes('countdown')) {
        countdown = {
          data: castCountdown(appData.countdown) || DEFAULT_COUNTDOWN,
          setData: setSelfCountdownData,
          auth: 'write',
        };
      }

      if (apps.includes('todo')) {
        todo = {
          data: sortTodos(appData.todo || []),
          setData: setSelfTodoData,
          auth: 'write',
        };
      }
    } else {
      let castedTimer = castTimer(participant.appDatas.timer);
      let castedCountdown = castCountdown(participant.appDatas.countdown);
      let castedTodo = sortTodos(participant.appDatas.todo || []);
      let appAuth = participant.appAuth;
      if (castedTimer) {
        timer = {
          data: castedTimer,
          setData: async (data) => {
            // update the timer data
            await setRemoteTimerData(appAuth, participantId, data);
          },
          auth: appAuth,
        };
      }
      if (castedCountdown) {
        countdown = {
          data: castedCountdown,
          setData: async (data) => {
            if (appAuth === 'write') await upload('countdown', { ...data, duration: data.duration?.toISOString() ?? null, timestamp: Date.now() });
          },
          auth: appAuth,
        };
      }
      todo = {
        data: castedTodo || [],
        setData: async (data) => {
          if (appAuth === 'write') await upload('todo', data);
        },
        auth: appAuth,
      };
    }
    return { timer, countdown, todo };
  })();
  const [activeTab, setActiveTab] = useState('todo');
  return {
    widgetData,
    activeTab,
    setActiveTab,
    messageApi,
    apps,
    space,
    spaceInfo,
    onHeightChange,
    isSelf,
    participantId,
    ref,
    activeKeys,
    setActiveKeys,
    t,
    token,
    showExport,
    setShowExport,
    containerRef,
    resizeObserverRef,
    itemStyle,
    appData,
    upload,
    setSelfTimerData,
    setRemoteTimerData,
    setSelfCountdownData,
    setSelfTodoData,
    updateAppSync,
    exportTodo,
    getTodoText,
    device,
  };
}
