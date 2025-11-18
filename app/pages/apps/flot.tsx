import { Button, Col, Collapse, CollapseProps, Popover, Row, theme, Tooltip } from 'antd';
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
import { RemoteTargetApp, socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import { DEFAULT_COLLAPSE_HEADER_STYLES } from '../controls/collapse_tools';
import { TodoTogether } from './todo_together';
import { AICutAnalysisMdTabs } from './ai_analysis_md';
import { AICutAnalysisRes, DEFAULT_AI_CUT_ANALYSIS_RES, Extraction } from '@/lib/ai/analysis';
import { CopyButton } from '../controls/widgets/copy';
import { useRecoilState } from 'recoil';
import { AICutService } from '@/lib/ai/cut';
import { isAuth } from '@/lib/std';

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
  startOrStopAICutAnalysis?: (
    freq: number,
    conf: AICutParticipantConf,
    reload?: boolean,
  ) => Promise<void>;
  openAIServiceAskNote?: () => void;
  cutInstance: AICutService;
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
  startOrStopAICutAnalysis,
  openAIServiceAskNote,
  aiCutAnalysisRes,
  cutInstance,
}: FlotLayoutProps) {
  const flotAppItemRef = useRef<FlotAppExports>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [showAICutAnalysis, setShowAICutAnalysis] = useState<boolean>(true);
  const { localParticipant } = useLocalParticipant();
  const [targetParticipant, setTargetParticipant] = useRecoilState(RemoteTargetApp);
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

  const contentWidth = useMemo(() => {
    if (layoutType.ty === 'desktop') {
      return 1108;
    } else if (layoutType.ty === 'pad') {
      return 788;
    } else {
      return 'calc(100vw - 48px)';
    }
  }, [layoutType]);

  const getRemoteAICutAnalysisRes = async (participantId: string) => {
    if (participantId && !isSelf) {
      // 发起请求获取结果
      const response = await api.ai.getAnalysisRes(space, participantId);
      if (response.ok) {
        const { res }: { res: AICutAnalysisRes } = await response.json();
        return res;
      }
    }
    return DEFAULT_AI_CUT_ANALYSIS_RES;
  };

  useEffect(() => {
    if (!isSelf && targetParticipant.participantId) {
        console.warn('Fetching remote AI Cut Analysis Result for', targetParticipant.participantId);
      getRemoteAICutAnalysisRes(targetParticipant.participantId).then((res) => {
          console.warn(res);
        setRemoteAnalysisRes(res);
      });
    }
  }, [isSelf, targetParticipant]);

  return (
    <div style={style} className={styles.flot_layout}>
      <Popover
        open={openApp}
        placement="leftTop"
        content={
          <Row gutter={8}>
            {layoutType.ty !== 'phone' && (
              <Col span={layoutType.span1}>
                {containerHeight > 0 && showAICutAnalysis && (
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
                      height: containerHeight,
                      width: '100%',
                    }}
                    cutInstance={cutInstance}
                    userId={targetParticipant.participantId || localParticipant.identity}
                  ></AICutAnalysisMdTabs>
                )}
              </Col>
            )}
            <Col span={layoutType.span2}>
              <FlotAppItem
                ref={flotAppItemRef}
                messageApi={messageApi}
                apps={spaceInfo.apps}
                space={space}
                spaceInfo={spaceInfo}
                onHeightChange={setContainerHeight}
                showAICutAnalysis={showAICutAnalysis}
                setShowAICutAnalysis={setShowAICutAnalysis}
                participantId={targetParticipant.participantId || localParticipant.identity}
                isSelf={isSelf}
              />
              {layoutType.ty === 'phone' && containerHeight > 0 && showAICutAnalysis && (
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
                    height: containerHeight,
                    width: '100%',
                  }}
                  cutInstance={cutInstance}
                  userId={targetParticipant.participantId || localParticipant.identity}
                ></AICutAnalysisMdTabs>
              )}
            </Col>
          </Row>
        }
        styles={{
          body: {
            background: '#1a1a1a',
            width: contentWidth,
            maxHeight: '86vh',
            height: 'fit-content',
            overflowY: 'scroll',
            overflowX: 'hidden',
            paddingRight: 0,
            paddingLeft: 8,
            paddingBottom: 0,
            scrollbarWidth: 'thin',
            scrollbarColor: '#888 transparent',
          },
        }}
      >
        <Button
          onClick={async () => {
            setTargetParticipant({
              participantId: localParticipant.identity,
              participantName: localParticipant.name,
              auth: 'write',
            });
            setOpenApp(!openApp);
          }}
          type="text"
          style={{ height: '100%', width: '100%' }}
          icon={<AppstoreOutlined style={{ fontSize: 16 }} />}
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
      isSelf,
      participantId,
    }: FlotAppItemProps,
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
        isAuth(participantId),
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

    const setSelfTodoData = async (todo: TodoItem[]) => {
      await upload('todo', {
        items: todo,
        timestamp: Date.now(),
      } as SpaceTodo);
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

    const exportTodo = (data: TodoItem[]) => {
      if (data.length === 0) {
        messageApi.info(t('more.app.todo.unexport'));
      } else {
        setShowExport(true);
      }
    };

    const showSyncIcon = (isSelf: boolean, key: AppKey) => {
      return !isSelf ? (
        <span></span>
      ) : (
        <>
          {spaceInfo.participants[participantId].sync.includes(key) ? (
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
      return `--- ${new Date().toLocaleDateString()} ---\n${todo.data
        .map((item, index) => `- [${item.done ? 'x' : ' '}] ${index + 1}. ${item.title}`)
        .join('\n')}
      `;
    };

    const createItems = (
      participantId: string,
      timer?: TimerProp,
      countdown?: CountdownProp,
      todo?: TodoProp,
      isSelf = false,
    ): CollapseProps['items'] => {
      let items: CollapseProps['items'] = [];

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
                          exportTodo(todo.data);
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
            data: castTodo(appData.todo) || [],
            setData: setSelfTodoData,
            auth: 'write',
          };
        }
      } else {
        let castedTimer = castTimer(participant.appDatas.timer);
        let castedCountdown = castCountdown(participant.appDatas.countdown);
        let castedTodo = castTodo(participant.appDatas.todo);
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
