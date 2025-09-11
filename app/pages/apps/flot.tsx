import { SvgResource } from '@/app/resources/svg';
import {
  Button,
  Collapse,
  CollapseProps,
  Popover,
  Tabs,
  TabsProps,
  theme,
  Tooltip,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from '@/styles/apps.module.scss';
import { AppTimer } from './timer';
import { AppCountdown } from './countdown';
import { AppTodo, ExportTodoHistroy } from './todo_list';
import { MessageInstance } from 'antd/es/message/interface';
import {
  ProfileOutlined,
  TeamOutlined,
  UserOutlined,
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

export interface FlotLayoutProps {
  style?: React.CSSProperties;
  messageApi: MessageInstance;
  openApp: boolean;
  spaceInfo: SpaceInfo;
  space: string;
}

export function FlotLayout({ style, messageApi, openApp, spaceInfo, space }: FlotLayoutProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (openApp && open) {
      setOpen(false);
    }
  }, [open, openApp]);

  return (
    <div style={style} className={styles.flot_layout}>
      <Popover
        open={open}
        placement="leftTop"
        content={
          <FlotAppItem
            messageApi={messageApi}
            apps={spaceInfo.apps}
            space={space}
            spaceInfo={spaceInfo}
          />
        }
        styles={{
          body: {
            background: '#1a1a1a90',
            width: '300px',
          },
        }}
      >
        <Button
          onClick={() => {
            if (openApp) return;
            setOpen(!open);
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

const DEFAULT_KEYS: AppKey[] = ['timer', 'countdown', 'todo'];

function FlotAppItem({ messageApi, apps, space, spaceInfo }: FlotAppItemProps) {
  const { localParticipant } = useLocalParticipant();
  const [activeKeys, setActiveKeys] = useState<Map<string, AppKey[]>>(
    new Map([[localParticipant.identity, DEFAULT_KEYS]]),
  );
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [showExport, setShowExport] = useState<boolean>(false);

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

  const selfAuth = useMemo(() => {
    if (spaceInfo.participants[localParticipant.identity]) {
      return spaceInfo.participants[localParticipant.identity].auth;
    }
    return 'read';
  }, [spaceInfo.participants]);

  // const toggleCollapse = (key: 'timer' | 'countdown' | 'todo') => {
  //   setActiveKeys((prev) => {
  //     if (prev.includes(key)) {
  //       return prev.filter((k) => k !== key);
  //     }
  //     return [...prev, key];
  //   });
  // };

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
      <Tooltip title={t('more.app.settings.sync.desc')}>
        {spaceInfo.participants[localParticipant.identity].sync.includes(key) ? (
          <TeamOutlined
            onClick={(e) => {
              e.stopPropagation();
              updateAppSync(key);
            }}
          />
        ) : (
          <UserOutlined
            onClick={(e) => {
              e.stopPropagation();
              updateAppSync(key);
            }}
          />
        )}
      </Tooltip>
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
          <div style={{ height: 22, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {showSyncIcon(isRemote, 'timer')}
            {activeKeys.get(participantId)?.includes('timer') ? '' : t('more.app.timer.title')}
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
      });
    }

    if (countdown) {
      items.push({
        key: 'countdown',
        label: (
          <div style={{ height: 22, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {showSyncIcon(isRemote, 'countdown')}
            {activeKeys.get(participantId)?.includes('countdown')
              ? ''
              : t('more.app.countdown.title')}
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
      });
    }

    if (todo) {
      items.push({
        key: 'todo',
        label: (
          <div style={{ height: 22, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {showSyncIcon(isRemote, 'todo')}
            {!isRemote && (
              <ProfileOutlined
                onClick={(e) => {
                  e.stopPropagation();
                  exportTodo(todo.data);
                }}
              />
            )}
            {activeKeys.get(participantId)?.includes('todo') ? '' : t('more.app.todo.title')}
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
      });
    }

    return items;
  }

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
  }, [apps, activeKeys, appData, showExport]);

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
            expandIconPosition="end"
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
                expandIconPosition="end"
                items={remoteItems}
              />
            ),
          });
        }
      });
    }

    return res;
  }, [spaceInfo, selfItems, activeKeys]);

  return <Tabs size="small" items={tabItems}></Tabs>;
}
