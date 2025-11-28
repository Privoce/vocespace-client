import { Button, Col, Collapse, CollapseProps, Drawer, Row, theme, Tooltip } from 'antd';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import styles from '@/styles/apps.module.scss';
import { AppTimer } from './timer';
import { AppCountdown } from './countdown';
import { AppTodo } from './todo_list';
import { MessageInstance } from 'antd/es/message/interface';
import {
  AppstoreOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/i18n';
import {
  AICutParticipantConf,
  AppAuth,
  AppKey,
  castCountdown,
  castTimer,
  Countdown,
  DEFAULT_COUNTDOWN,
  DEFAULT_TIMER,
  ParticipantSettings,
  RecordSettings,
  sortTodos,
  SpaceCountdown,
  SpaceInfo,
  SpaceTimer,
  SpaceTodo,
  Timer,
  todayTimeStamp,
} from '@/lib/std/space';
import { api } from '@/lib/api';
import { useLocalParticipant } from '@livekit/components-react';
import { RemoteTargetApp, socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import { DEFAULT_COLLAPSE_HEADER_STYLES } from '../controls/collapse_tools';
import { TodoTogether } from './todo_together';
import { AICutAnalysisMdTabs } from './ai_analysis_md';
import { AICutAnalysisRes, DEFAULT_AI_CUT_ANALYSIS_RES } from '@/lib/ai/analysis';
import { CopyButton } from '../controls/widgets/copy';
import { useRecoilState } from 'recoil';
import { AICutService } from '@/lib/ai/cut';
import { DEFAULT_DRAWER_PROP, DrawerCloser, DrawerHeader } from '../controls/drawer_tools';
import {
  convertPlatformToACARes,
  PlarformAICutAnalysis,
  platformAPI,
  PlatformTodos,
} from '@/lib/api/platform';
import { SvgResource } from '@/app/resources/svg';

export interface FlotButtonProps {
  style?: React.CSSProperties;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
}

export function FlotButton({ style, openApp, setOpenApp }: FlotButtonProps) {
  const { localParticipant } = useLocalParticipant();
  const [targetParticipant, setTargetParticipant] = useRecoilState(RemoteTargetApp);

  return (
    <Button
      onClick={async () => {
        if (!openApp && targetParticipant.participantId !== localParticipant.identity) {
          setTargetParticipant({
            participantId: localParticipant.identity,
            participantName: localParticipant.name,
            auth: 'write',
          });
        }
        setOpenApp(!openApp);
      }}
      type="text"
      style={{
        height: 'fit-content',
        width: 'fit-content',
        padding: '12px 2px',
        backgroundColor: '#00000050',
        borderRadius: '24px',
        color: '#fff',
        ...style,
      }}
      icon={<AppstoreOutlined style={{ fontSize: 16 }} />}
    ></Button>
  );
}

export interface FlotLayoutProps {
  messageApi: MessageInstance;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
  spaceInfo: SpaceInfo;
  space: string;
  showAICutAnalysisSettings?: (open: boolean) => void;
  aiCutAnalysisRes?: AICutAnalysisRes;
  reloadResult?: () => Promise<void>;
  startOrStopAICutAnalysis?: (
    freq: number,
    conf: AICutParticipantConf,
    reload?: boolean,
  ) => Promise<void>;
  openAIServiceAskNote?: () => void;
  cutInstance: AICutService;
  updateSettings: (
    newSettings: Partial<ParticipantSettings>,
    record?: RecordSettings,
    init?: boolean,
  ) => Promise<boolean | undefined>;
}

export function FlotLayout({
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
}: FlotLayoutProps) {
  const flotAppItemRef = useRef<FlotAppExports>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [showAICutAnalysis, setShowAICutAnalysis] = useState<boolean>(true);
  const { localParticipant } = useLocalParticipant();
  const [targetParticipant, setTargetParticipant] = useRecoilState(RemoteTargetApp);
  const [fetchData, setFetchData] = useState<boolean>(false);
  const isSelf = useMemo(() => {
    return localParticipant.identity === targetParticipant.participantId;
  }, [localParticipant.identity, targetParticipant.participantId]);
  const [remoteAnalysisRes, setRemoteAnalysisRes] = useState<AICutAnalysisRes>(
    DEFAULT_AI_CUT_ANALYSIS_RES,
  );

  // phone: window.innerWidth <= 728,
  // pad: window.innerWidth > 728 && window.innerWidth <= 1024,
  // desktop: window.innerWidth > 1024
  const layoutType: {
    span1: number;
    span2: number;
    ty: 'phone' | 'desktop' | 'pad';
  } = useMemo(() => {
    if (window.innerWidth <= 728) {
      return {
        span1: 24,
        span2: 24,
        ty: 'phone',
      };
    } else if (window.innerWidth > 728 && window.innerWidth <= 1024) {
      return {
        span1: 12,
        span2: 12,
        ty: 'pad',
      };
    } else {
      return {
        span1: 16,
        span2: 8,
        ty: 'desktop',
      };
    }
  }, [window.innerWidth]);

  const getRemoteAICutAnalysisRes = async (participantId: string) => {
    if (participantId && !isSelf) {
      // 发起请求获取结果
      if (
        targetParticipant.participantId &&
        spaceInfo.participants[targetParticipant.participantId]?.isAuth
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
        const response = await api.ai.getAnalysisRes(space, participantId);
        if (response.ok) {
          const { res }: { res: AICutAnalysisRes } = await response.json();
          return res;
        }
      }
    }
    return DEFAULT_AI_CUT_ANALYSIS_RES;
  };

  useEffect(() => {
    if (!isSelf && targetParticipant.participantId) {
      console.warn('Fetching remote AI Cut Analysis Result for', targetParticipant.participantId);
      getRemoteAICutAnalysisRes(targetParticipant.participantId).then((res) => {
        setRemoteAnalysisRes(res);
      });
    }
  }, [isSelf, targetParticipant, spaceInfo.participants]);

  const toPersonalPlatform = () => {
    if (spaceInfo.participants[localParticipant.identity]?.isAuth) {
      let url = `https://home.vocespace.com/ai/${localParticipant.identity}`;
      window.open(url, '_blank');
    }
  };

  const fetchTodo = async (participantId: string) => {
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
      await updateSettings({
        appDatas,
      });
      socket.emit('update_user_status', {
        space: space,
      } as WsBase);
    }
  };

  // 每次打开Drawer，如果是认证过的用户都需要去平台端请求最新的AI分析结果和TODO数据
  useEffect(() => {
    if (
      targetParticipant.participantId &&
      spaceInfo.participants[targetParticipant.participantId]?.isAuth &&
      fetchData
    ) {
      fetchTodo(targetParticipant.participantId).then(() => {
        setFetchData(false);
      });
    }
  }, [spaceInfo.participants, targetParticipant.participantId, fetchData]);
  // 每次openApp为true就重置fetchData
  useEffect(() => {
    if (openApp) {
      setFetchData(true);
    }
  }, [openApp]);

  return (
    <Drawer
      {...DEFAULT_DRAWER_PROP}
      open={openApp}
      onClose={() => setOpenApp(false)}
      title={
        <DrawerHeader
          title={'Widgets'}
          icon={
            spaceInfo.participants[localParticipant.identity]?.isAuth ? (
              <span
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
                onClick={toPersonalPlatform}
              >
                <SvgResource type="share" svgSize={16}></SvgResource>
              </span>
            ) : undefined
          }
        ></DrawerHeader>
      }
      extra={DrawerCloser({
        on_clicked: () => {
          setOpenApp(false);
        },
      })}
      width={1168}
      styles={{
        body: {
          padding: '0 24px',
          overflow: 'hidden',
        },
      }}
    >
      <Row gutter={8} style={{ height: '100%' }}>
        {layoutType.ty !== 'phone' && (
          <Col span={layoutType.span1}>
            {showAICutAnalysis && (
              <AICutAnalysisMdTabs
                result={isSelf ? aiCutAnalysisRes : remoteAnalysisRes}
                reloadResult={reloadResult}
                showSettings={showAICutAnalysisSettings}
                setFlotAppOpen={setOpenApp}
                spaceInfo={spaceInfo}
                startOrStopAICutAnalysis={startOrStopAICutAnalysis}
                openAIServiceAskNote={openAIServiceAskNote}
                messageApi={messageApi}
                isSelf={isSelf}
                style={{
                  height: '100%',
                  width: '100%',
                }}
                isAuthed={
                  spaceInfo.participants[
                    targetParticipant.participantId || localParticipant.identity
                  ]?.isAuth
                }
                cutInstance={cutInstance}
                userId={targetParticipant.participantId || localParticipant.identity}
              ></AICutAnalysisMdTabs>
            )}
          </Col>
        )}
        <Col
          span={layoutType.span2}
          style={{
            height: '100%',
            scrollbarWidth: 'thin',
            overflowY: 'scroll',
            overflowX: 'hidden',
          }}
        >
          <FlotAppItem
            ref={flotAppItemRef}
            messageApi={messageApi}
            apps={spaceInfo.apps}
            space={space}
            spaceInfo={spaceInfo}
            onHeightChange={setContainerHeight}
            participantId={targetParticipant.participantId || localParticipant.identity}
            isSelf={isSelf}
          />
          {layoutType.ty === 'phone' && showAICutAnalysis && (
            <AICutAnalysisMdTabs
              result={isSelf ? aiCutAnalysisRes : remoteAnalysisRes}
              reloadResult={reloadResult}
              showSettings={showAICutAnalysisSettings}
              setFlotAppOpen={setOpenApp}
              spaceInfo={spaceInfo}
              startOrStopAICutAnalysis={startOrStopAICutAnalysis}
              openAIServiceAskNote={openAIServiceAskNote}
              messageApi={messageApi}
              isSelf={isSelf}
              style={{
                height: '100%',
                width: '100%',
              }}
              isAuthed={
                spaceInfo.participants[targetParticipant.participantId || localParticipant.identity]
                  ?.isAuth
              }
              cutInstance={cutInstance}
              userId={targetParticipant.participantId || localParticipant.identity}
            ></AICutAnalysisMdTabs>
          )}
        </Col>
      </Row>
    </Drawer>
  );
}

interface FlotAppItemProps {
  messageApi: MessageInstance;
  apps: AppKey[];
  space: string;
  spaceInfo: SpaceInfo;
  onHeightChange?: (height: number) => void;
  isSelf: boolean;
  participantId: string;
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
  data: SpaceTodo[];
  setData: (data: SpaceTodo) => Promise<void>;
  auth: AppAuth;
}

const DEFAULT_KEYS: (AppKey | 'together')[] = ['timer', 'countdown', 'todo', 'together'];

export interface FlotAppExports {
  clientHeight?: number;
}

const FlotAppItem = forwardRef<FlotAppExports, FlotAppItemProps>(
  (
    { messageApi, apps, space, spaceInfo, onHeightChange, isSelf, participantId }: FlotAppItemProps,
    ref,
  ) => {
    const [activeKeys, setActiveKeys] = useState<(AppKey | 'together')[]>(DEFAULT_KEYS);
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

    const itemStyle: React.CSSProperties = {
      marginBottom: 8,
      background: token.colorFillAlter,
      borderRadius: token.borderRadiusSM,
      border: 'none',
    };

    const appData = useMemo(() => {
      return spaceInfo.participants[participantId]?.appDatas || {};
    }, [spaceInfo, participantId]);

    // 只有本地用户才有upload方法 ------------------------------------------------------------------
    const upload = async (key: AppKey, data: SpaceTimer | SpaceCountdown | SpaceTodo) => {
      const response = await api.uploadSpaceApp(
        space,
        participantId,
        key,
        data,
        spaceInfo.participants[participantId]?.isAuth,
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
      // 通过API更新
      // const response = await api.updateParticipantApp(participantId, 'timer', timer);
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

    const showSyncIcon = (isSelf: boolean, key: AppKey) => {
      if (!isSelf) {
        return <span></span>;
      }

      // 安全检查：确保参与者和 sync 属性存在
      const participant = spaceInfo.participants[participantId];
      if (!participant || !participant.sync) {
        return <span></span>;
      }

      return (
        <>
          {participant.sync.includes(key) ? (
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

    const createItems = (
      participantId: string,
      timer?: TimerProp,
      countdown?: CountdownProp,
      todo?: TodoProp,
      isSelf = false,
    ): CollapseProps['items'] => {
      let items: CollapseProps['items'] = [];

      if (todo) {
        items.push({
          key: 'todo',
          label: (
            <div className={styles.flot_header}>
              {t('more.app.todo.title')}
              <div className={styles.flot_header_icons}>
                {showSyncIcon(isSelf, 'todo')}
                {isSelf && (
                  <>
                    <Tooltip title={t('more.app.todo.complete')}>
                      <ProfileOutlined
                        onClick={(e) => {
                          e.stopPropagation();
                          exportTodo(todo.data.length);
                        }}
                      />
                    </Tooltip>
                    {/* <Tooltip title={t('more.ai.cut')}>
                      <RobotOutlined
                        disabled={!spaceInfo.participants[participantId]?.ai.cut}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAICutAnalysis(!showAICutAnalysis);
                        }}
                      />
                    </Tooltip> */}

                    <CopyButton text={getTodoText(todo)} messageApi={messageApi}></CopyButton>
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

      if (isSelf) {
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

      if (timer) {
        items.push({
          key: 'timer',
          label: (
            <div className={styles.flot_header}>
              {t('more.app.timer.title')}
              {showSyncIcon(isSelf, 'timer')}
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
              {showSyncIcon(isSelf, 'countdown')}
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

      return items;
    };

    const app = useMemo(() => {
      if (!spaceInfo) return <></>;

      const participant = spaceInfo.participants[participantId];
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
        let auth = participant.auth;
        if (castedTimer) {
          timer = {
            data: castedTimer,
            setData: async (data) => {
              // update the timer data
              await setRemoteTimerData(auth, participantId, data);
            },
            auth,
          };
        }
        if (castedCountdown) {
          countdown = {
            data: castedCountdown,
            setData: async (data) => {
              // update the countdown data
            },
            auth,
          };
        }
        todo = {
          data: castedTodo || [],
          setData: async (data) => {
            // update the todo data
            console.warn(data);
          },
          auth,
        };
      }
      const items = createItems(participantId, timer, countdown, todo, isSelf);
      return (
        <Collapse
          bordered={false}
          activeKey={activeKeys}
          onChange={(keys) => {
            setActiveKeys(keys as AppKey[]);
          }}
          expandIconPosition="start"
          items={items}
        />
      );
    }, [spaceInfo, participantId, activeKeys, isSelf, showExport]);

    useImperativeHandle(ref, () => ({
      clientHeight: containerRef.current?.clientHeight,
    }));
    // 暂时不使用tab，返回自己的即可
    // return <Tabs style={{ width: 360 }} size="small" items={tabItems}></Tabs>;
    return (
      <div ref={containerRef} className={styles.flot_app_item}>
        {app}
      </div>
    );
  },
);
