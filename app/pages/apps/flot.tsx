import { SvgResource } from '@/app/resources/svg';
import { Button, Collapse, CollapseProps, Popover, Tabs, TabsProps, theme, Tooltip } from 'antd';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import styles from '@/styles/apps.module.scss';
import { AppTimer } from './timer';
import { AppCountdown } from './countdown';
import { AppTodo } from './todo_list';
import { MessageInstance } from 'antd/es/message/interface';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  ProfileOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/i18n';
import {
  AppAuth,
  AppKey,
  castCountdown,
  castTimer,
  castTodo,
  Countdown,
  DEFAULT_COUNTDOWN,
  DEFAULT_TIMER,
  SpaceCountdown,
  SpaceInfo,
  SpaceTimer,
  SpaceTodo,
  Timer,
  TodoItem,
} from '@/lib/std/space';
import { api } from '@/lib/api';
import { useLocalParticipant } from '@livekit/components-react';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import { DEFAULT_COLLAPSE_HEADER_STYLES } from '../controls/collapse_tools';
import { TodoTogether } from './todo_together';
import { AICutAnalysisMdTabs } from './ai_analysis_md';
import { AICutAnalysisRes } from '@/lib/ai/analysis';

export interface FlotLayoutProps {
  style?: React.CSSProperties;
  messageApi: MessageInstance;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
  spaceInfo: SpaceInfo;
  space: string;
  showAICutAnalysisSettings?: (open: boolean) => void;
  aiCutAnalysisRes?: AICutAnalysisRes;
  reloadResult?: () => Promise<void>;
}

export function FlotLayout({
  style,
  messageApi,
  openApp,
  spaceInfo,
  space,
  setOpenApp,
  showAICutAnalysisSettings,
  reloadResult,
  aiCutAnalysisRes,
}: FlotLayoutProps) {
  const flotAppItemRef = useRef<FlotAppExports>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [showAICutAnalysis, setShowAICutAnalysis] = useState<boolean>(true);

  return (
    <div style={style} className={styles.flot_layout}>
      <Popover
        open={openApp}
        placement="leftTop"
        content={
          <div className={styles.flot_app_content}>
            {containerHeight > 0 && showAICutAnalysis && (
              <AICutAnalysisMdTabs
                result={aiCutAnalysisRes}
                reloadResult={reloadResult}
                height={containerHeight - 8}
                showSettings={showAICutAnalysisSettings}
                setFlotAppOpen={setOpenApp}
              ></AICutAnalysisMdTabs>
            )}
            <FlotAppItem
              ref={flotAppItemRef}
              messageApi={messageApi}
              apps={spaceInfo.apps}
              space={space}
              spaceInfo={spaceInfo}
              onHeightChange={setContainerHeight}
              showAICutAnalysis={showAICutAnalysis}
              setShowAICutAnalysis={setShowAICutAnalysis}
            />
          </div>
        }
        styles={{
          body: {
            background: '#1a1a1a',
            width: 'fit-content',
            maxHeight: '86vh',
            height: 'fit-content',
            overflowY: 'scroll',
            paddingRight: 0,
            paddingBottom: 0,
            scrollbarWidth: 'thin',
            scrollbarColor: '#888 transparent',
          },
        }}
      >
        <Button
          onClick={() => {
            setOpenApp(!openApp);
          }}
          type="text"
          style={{ height: '100%', width: '100%' }}
          icon={<SvgResource type="app" svgSize={16}></SvgResource>}
        ></Button>
      </Popover>
    </div>
  );
}

interface FlotAppItemProps {
  messageApi: MessageInstance;
  apps: AppKey[];
  space: string;
  spaceInfo: SpaceInfo;
  onHeightChange?: (height: number) => void;
  setShowAICutAnalysis: (show: boolean) => void;
  showAICutAnalysis: boolean;
}

export interface TimerProp {
  data: Timer;
  setData: (data: Timer) => Promise<void>;
  auth: AppAuth;
}

export interface CountdownProp {
  data: Countdown;
  setData: (data: Countdown) => Promise<void>;
  auth: AppAuth;
}
export interface TodoProp {
  data: TodoItem[];
  setData: (data: TodoItem[]) => Promise<void>;
  auth: AppAuth;
}

const DEFAULT_KEYS: (AppKey | 'together')[] = ['timer', 'countdown', 'todo', 'together'];

export interface FlotAppExports {
  clientHeight?: number;
}

const FlotAppItem = forwardRef<FlotAppExports, FlotAppItemProps>(
  (
    {
      messageApi,
      apps,
      space,
      spaceInfo,
      onHeightChange,
      setShowAICutAnalysis,
      showAICutAnalysis,
    }: FlotAppItemProps,
    ref,
  ) => {
    const { localParticipant } = useLocalParticipant();
    const [activeKeys, setActiveKeys] = useState<Map<string, (AppKey | 'together')[]>>(
      new Map([[localParticipant.identity, DEFAULT_KEYS]]),
    );
    const { t } = useI18n();
    const { token } = theme.useToken();
    const [showExport, setShowExport] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    // 监听容器高度变化
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

    // 初始化远程用户的 activeKeys
    useEffect(() => {
      const remoteParticipantKeys = Object.keys(spaceInfo.participants).filter((k) => {
        return k !== localParticipant.identity;
      });

      setActiveKeys((prev) => {
        const newMap = new Map(prev);

        remoteParticipantKeys.forEach((participantId) => {
          const participant = spaceInfo.participants[participantId];
          if (participant?.sync && !newMap.has(participantId)) {
            const keys: AppKey[] = [];
            if (participant.appDatas?.timer) keys.push('timer');
            if (participant.appDatas?.countdown) keys.push('countdown');
            if (participant.appDatas?.todo) keys.push('todo');
            newMap.set(participantId, keys);
          }
        });

        return newMap;
      });
    }, [spaceInfo.participants, localParticipant.identity]);

    const itemStyle: React.CSSProperties = {
      marginBottom: 8,
      background: token.colorFillAlter,
      borderRadius: token.borderRadiusSM,
      border: 'none',
    };

    const appData = useMemo(() => {
      return spaceInfo.participants[localParticipant.identity]?.appDatas || {};
    }, [spaceInfo, localParticipant]);

    // const selfAuth = useMemo(() => {
    //   if (spaceInfo.participants[localParticipant.identity]) {
    //     return spaceInfo.participants[localParticipant.identity].auth;
    //   }
    //   return 'read';
    // }, [spaceInfo.participants]);

    const upload = async (key: AppKey, data: SpaceTimer | SpaceCountdown | SpaceTodo) => {
      let participantId = localParticipant.identity;
      const response = await api.uploadSpaceApp(space, participantId, key, data);
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
      // 通过API更新
      // const response = await api.updateParticipantApp(participantId, 'timer', timer);
    };

    const setSelfCountdownData = async (countdown: Countdown) => {
      await upload('countdown', {
        ...countdown,
        timestamp: Date.now(),
      } as SpaceCountdown);
    };

    const setSelfTodoData = async (todo: TodoItem[]) => {
      await upload('todo', {
        items: todo,
        timestamp: Date.now(),
      } as SpaceTodo);
    };

    const updateAppSync = async (key: AppKey) => {
      const response = await api.updateSpaceAppSync(space, localParticipant.identity, key);
      if (response.ok) {
        socket.emit('update_user_status', {
          space,
        } as WsBase);
        messageApi.success(t('more.app.settings.sync.update.success'));
      } else {
        messageApi.error(t('more.app.settings.sync.update.error'));
      }
    };

    const exportTodo = (data: TodoItem[]) => {
      if (data.length === 0) {
        messageApi.info(t('more.app.todo.unexport'));
      } else {
        setShowExport(true);
      }
    };

    const showSyncIcon = (isRemote: boolean, key: AppKey) => {
      return isRemote ? (
        <span></span>
      ) : (
        <>
          {spaceInfo.participants[localParticipant.identity].sync.includes(key) ? (
            <Tooltip title={t('more.app.settings.sync.desc_priv')}>
              <EyeOutlined
                onClick={(e) => {
                  e.stopPropagation();
                  updateAppSync(key);
                }}
              />
            </Tooltip>
          ) : (
            <Tooltip title={t('more.app.settings.sync.desc_pub')}>
              <EyeInvisibleOutlined
                onClick={(e) => {
                  e.stopPropagation();
                  updateAppSync(key);
                }}
              />
            </Tooltip>
          )}
        </>
      );
    };

    const createItems = (
      participantId: string,
      timer?: TimerProp,
      countdown?: CountdownProp,
      todo?: TodoProp,
      isRemote = false,
    ): CollapseProps['items'] => {
      let items: CollapseProps['items'] = [];

      if (timer) {
        items.push({
          key: 'timer',
          label: (
            <div className={styles.flot_header}>
              {t('more.app.timer.title')}
              {showSyncIcon(isRemote, 'timer')}
            </div>
          ),
          children: (
            <AppTimer
              size="small"
              appData={timer.data}
              setAppData={timer.setData}
              auth={timer.auth}
            ></AppTimer>
          ),
          style: itemStyle,
          styles: DEFAULT_COLLAPSE_HEADER_STYLES,
        });
      }

      if (countdown) {
        items.push({
          key: 'countdown',
          label: (
            <div className={styles.flot_header}>
              {t('more.app.countdown.title')}
              {showSyncIcon(isRemote, 'countdown')}
            </div>
          ),
          children: (
            <AppCountdown
              messageApi={messageApi}
              size="small"
              appData={countdown.data}
              setAppData={countdown.setData}
              auth={countdown.auth}
            />
          ),
          style: itemStyle,
          styles: DEFAULT_COLLAPSE_HEADER_STYLES,
        });
      }

      if (todo) {
        items.push({
          key: 'todo',
          label: (
            <div className={styles.flot_header}>
              {t('more.app.todo.title')}
              <div className={styles.flot_header_icons}>
                {showSyncIcon(isRemote, 'todo')}
                {!isRemote && (
                  <>
                    <Tooltip title={t('more.app.todo.complete')}>
                      <ProfileOutlined
                        onClick={(e) => {
                          e.stopPropagation();
                          exportTodo(todo.data);
                        }}
                      />
                    </Tooltip>
                    <Tooltip title={t('more.ai.cut')}>
                      <RobotOutlined
                        disabled={!spaceInfo.participants[participantId]?.ai.cut}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAICutAnalysis(!showAICutAnalysis);
                        }}
                      />
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          ),
          children: (
            <AppTodo
              messageApi={messageApi}
              appData={todo.data}
              setAppData={todo.setData}
              auth={todo.auth}
              showExport={showExport}
              setShowExport={setShowExport}
            />
          ),
          style: itemStyle,
          styles: DEFAULT_COLLAPSE_HEADER_STYLES,
        });
      }

      if (!isRemote) {
        items.push({
          key: 'together',
          label: (
            <div className={styles.flot_header}>
              {/* {showSyncIcon(isRemote, 'timer')} */}
              {t('more.app.todo.together.title')}
            </div>
          ),
          children: <TodoTogether spaceInfo={spaceInfo} messageApi={messageApi}></TodoTogether>,
          style: itemStyle,
          styles: DEFAULT_COLLAPSE_HEADER_STYLES,
        });
      }

      return items;
    };

    const selfItems: CollapseProps['items'] = useMemo(() => {
      // items.filter((item) => apps.includes(item.key as AppKey))
      let timer: TimerProp | undefined = undefined;
      if (apps.includes('timer')) {
        timer = {
          data: castTimer(appData.timer) || DEFAULT_TIMER,
          setData: setSelfTimerData,
          auth: 'write',
        };
      }
      let countdown: CountdownProp | undefined = undefined;
      if (apps.includes('countdown')) {
        countdown = {
          data: castCountdown(appData.countdown) || DEFAULT_COUNTDOWN,
          setData: setSelfCountdownData,
          auth: 'write',
        };
      }
      let todo: TodoProp | undefined = undefined;
      if (apps.includes('todo')) {
        todo = {
          data: castTodo(appData.todo) || [],
          setData: setSelfTodoData,
          auth: 'write',
        };
      }

      const items = createItems(localParticipant.identity, timer, countdown, todo);

      if (!items) {
        return [];
      }

      return items;
    }, [apps, activeKeys, appData, showExport, showAICutAnalysis]);

    const tabItems: TabsProps['items'] = useMemo(() => {
      let remoteParticipantKeys = Object.keys(spaceInfo.participants).filter((k) => {
        return k !== localParticipant.identity;
      });

      const remoteAppDatas = remoteParticipantKeys.map((key) => {
        return {
          id: key,
          name: spaceInfo.participants[key].name,
          auth: spaceInfo.participants[key].auth,
          sync: spaceInfo.participants[key].sync,
          appDatas: spaceInfo.participants[key].appDatas,
        };
      });
      let res = [
        {
          key: 'self',
          label: t('more.app.tab.self'),
          children: (
            <Collapse
              bordered={false}
              activeKey={activeKeys.get(localParticipant.identity)}
              onChange={(keys) => {
                setActiveKeys((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(localParticipant.identity, keys as AppKey[]);
                  return newMap;
                });
              }}
              expandIconPosition="start"
              items={selfItems}
            />
          ),
        },
      ];

      if (remoteAppDatas.length > 0) {
        remoteAppDatas.forEach((v) => {
          if (v.sync) {
            let castedTimer = castTimer(v.appDatas.timer);
            let castedCountdown = castCountdown(v.appDatas.countdown);
            let castedTodo = castTodo(v.appDatas.todo);

            let timer: TimerProp | undefined = undefined;
            if (castedTimer) {
              timer = {
                data: castedTimer,
                setData: async (data) => {
                  // update the timer data
                  await setRemoteTimerData(v.auth, v.id, data);
                },
                auth: v.auth,
              };
            }
            let countdown: CountdownProp | undefined = undefined;
            if (castedCountdown) {
              countdown = {
                data: castedCountdown,
                setData: async (data) => {
                  // update the countdown data
                },
                auth: v.auth,
              };
            }
            let todo: TodoProp | undefined = undefined;
            if (castedTodo) {
              todo = {
                data: castedTodo,
                setData: async (data) => {
                  // update the todo data
                  console.warn(data);
                },
                auth: v.auth,
              };
            }

            let remoteItems = createItems(v.id, timer, countdown, todo, true);
            setActiveKeys((prev) => {
              if (!prev.has(v.id)) {
                const newMap = new Map(prev);
                newMap.set(v.id, DEFAULT_KEYS);
                return newMap;
              }
              return prev;
            });

            res.push({
              key: v.id,
              label: v.name,
              children: (
                <Collapse
                  bordered={false}
                  activeKey={activeKeys.get(v.id)}
                  onChange={(keys) => {
                    setActiveKeys((prev) => {
                      const newMap = new Map(prev);
                      newMap.set(v.id, keys as AppKey[]);
                      return newMap;
                    });
                  }}
                  expandIconPosition="start"
                  items={remoteItems}
                />
              ),
            });
          }
        });
      }

      return res;
    }, [spaceInfo, selfItems, activeKeys]);

    useImperativeHandle(ref, () => ({
      clientHeight: containerRef.current?.clientHeight,
    }));
    // 暂时不使用tab，返回自己的即可
    // return <Tabs style={{ width: 360 }} size="small" items={tabItems}></Tabs>;
    return (
      <div ref={containerRef} className={styles.flot_app_item}>
        {tabItems.find((item) => item.key === 'self')?.children}
      </div>
    );
  },
);
