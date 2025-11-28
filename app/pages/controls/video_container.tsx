import { isMobile, src, UserDefineStatus, UserStatus } from '@/lib/std';
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayoutContainer,
  GridLayout,
  isTrackReference,
  LayoutContextProvider,
  RoomAudioRenderer,
  TrackReference,
  useCreateLayoutContext,
  useMaybeRoomContext,
  usePinnedTracks,
  useTracks,
  VideoConferenceProps,
  WidgetState,
} from '@livekit/components-react';
import {
  ConnectionState,
  LocalTrackPublication,
  Participant,
  ParticipantEvent,
  ParticipantTrackPermission,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
} from 'livekit-client';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ControlBarExport, Controls } from './bar';
import { useRecoilState } from 'recoil';
import { ParticipantItem } from '../participant/tile';
import { useSpaceInfo } from '@/lib/hooks/space';
import { MessageInstance } from 'antd/es/message/interface';
import { NotificationInstance } from 'antd/es/notification/interface';
import { useI18n } from '@/lib/i18n/i18n';
import {
  chatMsgState,
  licenseState,
  RemoteTargetApp,
  roomStatusState,
  socket,
  userState,
} from '@/app/rooms/[spaceName]/PageClientImpl';
import {
  ControlType,
  WsBase,
  WsControlParticipant,
  WsInviteDevice,
  WsParticipant,
  WsSender,
  WsTo,
  WsWave,
} from '@/lib/std/device';
import { Button } from 'antd';
import { ChatMsgItem } from '@/lib/std/chat';
import { Channel, ChannelExports } from './channel';
import {
  AICutParticipantConf,
  AppAuth,
  PARTICIPANT_SETTINGS_KEY,
  SpaceTodo,
  todayTimeStamp,
} from '@/lib/std/space';
import { FlotButton, FlotLayout } from '../apps/flot';
import { api } from '@/lib/api';
import { analyzeLicense, getLicensePersonLimit, validLicenseDomain } from '@/lib/std/license';
import { VocespaceConfig } from '@/lib/std/conf';
import { acceptRaise, RaiseHandler, rejectRaise } from './widgets/raise';
import { audio } from '@/lib/audio';
import { AICutService } from '@/lib/ai/cut';
import { AICutAnalysisRes, DEFAULT_AI_CUT_ANALYSIS_RES, Extraction } from '@/lib/ai/analysis';
import {
  convertPlatformToACARes,
  PlarformAICutAnalysis,
  platformAPI,
  PlatformTodos,
} from '@/lib/api/platform';

export interface VideoContainerProps extends VideoConferenceProps {
  messageApi: MessageInstance;
  noteApi: NotificationInstance;
  setPermissionDevice: (device: Track.Source) => void;
  config: VocespaceConfig;
}

export interface VideoContainerExports {
  clearRoom: () => Promise<void>;
}

export const VideoContainer = forwardRef<VideoContainerExports, VideoContainerProps>(
  (
    {
      chatMessageFormatter,
      chatMessageDecoder,
      chatMessageEncoder,
      SettingsComponent,
      noteApi,
      messageApi,
      setPermissionDevice,
      config,
      ...props
    }: VideoContainerProps,
    ref,
  ) => {
    const space = useMaybeRoomContext();
    const [init, setInit] = useState(true);
    const { t, locale } = useI18n();
    const [uState, setUState] = useRecoilState(userState);
    const [collapsed, setCollapsed] = useState(isMobile());
    const [uLicenseState, setULicenseState] = useRecoilState(licenseState);
    const controlsRef = React.useRef<ControlBarExport>(null);
    const waveAudioRef = React.useRef<HTMLAudioElement>(null);
    const promptSoundRef = React.useRef<HTMLAudioElement>(null);
    const [isFocus, setIsFocus] = useState(false);
    const [freshPermission, setFreshPermission] = useState(false);
    const [cacheWidgetState, setCacheWidgetState] = useState<WidgetState>();
    const [chatMsg, setChatMsg] = useRecoilState(chatMsgState);
    const [uRoomStatusState, setURoomStatusState] = useRecoilState(roomStatusState);
    const channelRef = React.useRef<ChannelExports>(null);
    const [remoteApp, setRemoteApp] = useRecoilState(RemoteTargetApp);
    const { settings, updateSettings, fetchSettings, clearSettings, updateOwnerId, updateRecord } =
      useSpaceInfo(
        space?.name || '', // 房间 ID
        space?.localParticipant?.identity || '', // 参与者 ID
      );
    const [openApp, setOpenApp] = useState<boolean>(false);
    // const [targetAppKey, setTargetAppKey] = useState<AppKey | undefined>(undefined);
    // const [openSingleApp, setOpenSingleApp] = useState<boolean>(false);
    const isActive = true;
    const aiCutServiceRef = React.useRef<AICutService>(new AICutService());
    const [noteStateForAICutService, setNoteStateForAICutService] = useState({
      openAIService: false,
      noteClosed: false,
      hasAsked: !settings?.ai?.cut?.enabled || false, // 如果设置中enabled为true表示需要询问，否则不需要询问
    });
    const [aiCutAnalysisRes, setAICutAnalysisRes] = useState<AICutAnalysisRes>(
      DEFAULT_AI_CUT_ANALYSIS_RES,
    );
    const aiCutAnalysisIntervalId = useRef<NodeJS.Timeout | null>(null);
    const showFlotApp = (id?: string, participantName?: string, auth?: AppAuth) => {
      setRemoteApp({
        participantId: id,
        participantName,
        auth: auth || 'read',
      });

      setOpenApp(!openApp);
    };
    const reloadResult = async () => {
      const response = await api.ai.getAnalysisRes(space!.name, space!.localParticipant.identity);
      if (response.ok) {
        const { res }: { res: AICutAnalysisRes } = await response.json();
        setAICutAnalysisRes(res);
        messageApi.success(t('ai.cut.success.reload'));
      } else {
        messageApi.error(t('ai.cut.error.reload'));
      }
    };
    const stopAICutService = async (space: Room) => {
      aiCutServiceRef.current.stop();
      aiCutServiceRef.current.clearScreenshots();
      if (aiCutAnalysisIntervalId.current) {
        clearInterval(aiCutAnalysisIntervalId.current);
        aiCutAnalysisIntervalId.current = null;
      }
      const response = await api.ai.stop(space.name, space.localParticipant.identity);
      if (response.ok) {
        // messageApi.success(t('ai.cut.success.stop'));
      }
    };
    // 开启或关闭AI截屏服务 --------------------------------------------------------
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
                      ?.map((todo) => todo.items.filter((item) => !item.done))
                      .flat()
                      .map((item) => item.title) || [];
                }

                const response = await api.ai.analysis({
                  spaceName: space.name,
                  userId: space.localParticipant.identity,
                  screenShot: lastScreenShot,
                  todos,
                  freq: freq,
                  lang: locale,
                  extraction: conf.extraction,
                  isAuth: uState.isAuth,
                });

                if (!response.ok) {
                  messageApi.warning(t('ai.cut.error.start'));
                  // 停止AI截屏服务
                  stopAICutService(space);
                  await updateSettings({
                    ai: {
                      cut: {
                        ...conf,
                        enabled: false,
                      },
                    },
                  });
                  socket.emit('update_user_status', {
                    space: space.name,
                  } as WsBase);
                  return;
                }
              }
            },
            () => {
              messageApi.success(t('ai.cut.success.start'));
            },
            (e) => {
              console.error('Failed to start AI Cut Service:', e);
              messageApi.warning(t('ai.cut.error.start'));
            },
          );
          // 如果已有定时器，先清除，避免重复创建多个定时器
          if (aiCutAnalysisIntervalId.current) {
            try {
              clearInterval(aiCutAnalysisIntervalId.current as unknown as number);
            } catch (e) {
              // ignore
            }
            aiCutAnalysisIntervalId.current = null;
          }

          aiCutAnalysisIntervalId.current = setInterval(async () => {
            await reloadResult();
          }, (freq + 2) * 60 * 1000); //增加2分钟的缓冲时间
        } else {
          // 停止截图服务并停止AI分析
          stopAICutService(space);
        }

        await updateSettings({
          ai: {
            cut: { ...conf },
          },
        });
        socket.emit('update_user_status', {
          space: space.name,
        } as WsBase);
      },
      [space, settings.ai.cut, uState, t, updateSettings, aiCutAnalysisIntervalId, locale],
    );

    const openAIServiceAskNote = () => {
      // 提示用户开启屏幕共享权限, 关闭后判断开启还是关闭AI服务
      noteApi.open({
        message: t('ai.cut.ask_permission_title'),
        description: t('ai.cut.ask_permission'),
        duration: 10,
        onClose: async () => {
          // 用户关闭弹窗或超时关闭，默认不开启AI服务
          setNoteStateForAICutService({
            openAIService: false,
            noteClosed: true,
            hasAsked: true,
          });
        },
        actions: (
          <div style={{ display: 'inline-flex', gap: 16 }}>
            <Button
              type="primary"
              onClick={() => {
                // 用户选择开启屏幕共享和AI服务
                space?.localParticipant.setScreenShareEnabled(true);
                setNoteStateForAICutService({
                  hasAsked: true,
                  openAIService: true,
                  noteClosed: true,
                });
                noteApi.destroy();
              }}
            >
              {t('common.start_sharing')}
            </Button>
          </div>
        ),
      });
    };

    // 监控AI截屏服务状态 --------------------------------------------------------
    // 用户需要确保至少开启屏幕共享，如果关闭则需要提示用户，如果用户确定关闭则要停止AI截屏服务
    // 手机无需AI分享分析提示
    useEffect(() => {
      // 完成初始化并没有询问过用户时显示弹窗并询问
      if (
        !init &&
        (settings.ai.cut.enabled === undefined
          ? !noteStateForAICutService.hasAsked
          : !settings.ai.cut.enabled) &&
        !isMobile()
      ) {
        openAIServiceAskNote();
      }
    }, [init, noteStateForAICutService.hasAsked, settings.ai.cut.enabled]);

    useEffect(() => {
      if (noteStateForAICutService.noteClosed) {
        startOrStopAICutAnalysis(settings.ai.cut.freq, {
          ...uState.ai.cut,
          enabled: noteStateForAICutService.openAIService,
        });
      }
    }, [noteStateForAICutService.noteClosed, noteStateForAICutService.openAIService]);

    useEffect(() => {
      if (!space) return;
      if (!socket.id) {
        messageApi.warning(t('common.socket_reconnect'));
        setTimeout(() => {
          socket.connect();
        }, 200);
      }
      if (
        space.state === ConnectionState.Connecting ||
        space.state === ConnectionState.Reconnecting
      ) {
        setInit(true);
        return;
      } else if (space.state !== ConnectionState.Connected) {
        return;
      }
      // 当socket需要重连时 ------------------------------------------------------------------------
      socket.on('connect', () => {
        console.warn('Socket connect/reconnected:', socket.id);
        setInit(true);
      });

      // 从平台端获取数据 ai总结/todos ---------------------------------------------------------------
      const fetchPlatformData = async (isAuth: boolean) => {
        // todos ----
        let identity = space.localParticipant.identity;
        if (isAuth) {
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
            const items: SpaceTodo[] = todos.map((todo) => {
              return {
                items: todo.items,
                date: Number(todo.date),
              };
            });

            // 更新本地数据
            return items;
          }
        }

        return [];
      };

      const syncSettings = async () => {
        let isAuth = await platformAPI.isAuth(space.localParticipant.identity);
        const todos = await fetchPlatformData(isAuth);
        // 将当前参与者的基础设置发送到服务器 ----------------------------------------------------------
        await updateSettings(
          {
            ...uState,
            socketId: socket.id,
            name: space.localParticipant.name || space.localParticipant.identity,
            startAt: new Date().getTime(),
            online: true,
            ...(todos ? { appDatas: { ...uState.appDatas, todo: todos } } : uState.appDatas),
            isAuth,
          },
          undefined,
          true,
        );

        const roomName = `${space.localParticipant.name}'s room`;

        // 为新加入的参与者创建一个自己的私人房间
        if (!settings.children.some((child) => child.name === roomName)) {
          const response = await api.createRoom({
            spaceName: space.name,
            roomName,
            ownerId: space.localParticipant.identity,
            isPrivate: true,
          });

          if (!response.ok) {
            messageApi.error({
              content: t('channel.create.error'),
            });
          } else {
            await fetchSettings();
          }
        }
      };

      // 获取历史聊天记录 ---------------------------------------------------------------------------
      const fetchChatMsg = async () => {
        const response = await api.getChatMsg(space.name);
        if (response.ok) {
          const { msgs }: { msgs: ChatMsgItem[] } = await response.json();
          let othersMsgLength = msgs.filter(
            (msg) => msg.id !== space.localParticipant.identity,
          ).length;
          setChatMsg((prev) => ({
            unhandled: prev.unhandled + othersMsgLength,
            msgs: [...prev.msgs, ...msgs],
          }));
        } else {
          console.error('Failed to fetch chat messages:', response.statusText);
        }
      };

      // 从config中获取license进行校验 -------------------------------------------------------------------
      const validLicense = async () => {
        if (!uLicenseState.isAnalysis) {
          const license = analyzeLicense(config.license, (_e) => {
            messageApi.error({
              content: t('settings.license.invalid') + t('settings.license.default_license'),
              duration: 8,
            });
          });
          if (!validLicenseDomain(license.domains, config.serverUrl)) {
            messageApi.error(t('settings.license.invalid_domain'));
            space.disconnect(true);
            return;
          }

          setULicenseState({
            ...license,
            isAnalysis: true,
            personLimit: getLicensePersonLimit(license.limit, license.isTmp),
          });
        }
      };

      if (init) {
        // 重置AI截图询问状态，允许在新会话中重新询问
        setNoteStateForAICutService({
          openAIService: false,
          noteClosed: false,
          hasAsked: false,
        });

        // 获取历史聊天记录
        validLicense().then(() => {
          fetchChatMsg();
          syncSettings().then(() => {
            // 新的用户更新到服务器之后，需要给每个参与者发送一个websocket事件，通知他们更新用户状态
            socket.emit('update_user_status', {
              space: space.name,
            } as WsBase);
          });
          setInit(false);
        });
      }

      // 重写初始化用户 -----------------------------------------------------------------------------
      socket.on('re_init_response', async (msg: WsParticipant) => {
        if (msg.space === space.name && msg.participantId === space.localParticipant.identity) {
          // 只有在用户没有正常初始化时才会触发
          setInit(true);
        }
      });

      // 监听服务器的提醒事件的响应 -------------------------------------------------------------------
      socket.on('wave_response', (msg: WsWave) => {
        if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
          waveAudioRef.current?.play();
          let actions = undefined;
          if (msg.childRoom || msg.inSpace) {
            actions = (
              <Button
                type="primary"
                size="small"
                onClick={async () => {
                  if (msg.inSpace) {
                    // 加入主房间
                    await channelRef.current?.joinMain();
                  } else {
                    // 加入子房间
                    await channelRef.current?.join(msg.childRoom!, space.localParticipant.identity);
                  }
                  noteApi.destroy();
                }}
              >
                {t('channel.join.title')}
              </Button>
            );
          }

          noteApi.info({
            message: `${msg.senderName} ${t('common.wave_msg')}`,
            actions,
            duration: 10,
          });
        }
      });

      // 监听服务器的用户状态更新事件 -------------------------------------------------------------------
      socket.on('user_status_updated', async (msg: WsBase) => {
        // 调用fetchSettings
        // 另一个环境是没有参数的，可能导致错误，所以这里强制判断msg
        if (msg && msg.space && msg.space === space.name) {
          await fetchSettings();
        }
      });

      // 房间事件监听器 --------------------------------------------------------------------------------
      const onParticipantConnected = async (participant: Participant) => {
        // 通过许可证判断人数
        if (space.remoteParticipants.size >= uLicenseState.personLimit - 1) {
          if (space.localParticipant.identity === participant.identity) {
            messageApi.error({
              content: t('common.full_user'),
              duration: 3,
            });
            space.disconnect(true);
          }
          return;
        }
        // 参与者进入之后发出提示音
        if (uState.openPromptSound && promptSoundRef.current) {
          promptSoundRef.current.play();
        }
      };
      const onParticipantDisConnected = async (participant: Participant) => {
        socket.emit('mouse_remove', {
          space: space.name,
          senderName: participant.name || participant.identity,
          senderId: participant.identity,
          receiverId: '',
          socketId: '',
        } as WsTo);
        // do clearSettings but use leave participant
        await clearSettings(participant.identity);
      };
      // 监听远程参与者连接事件 --------------------------------------------------------------------------
      space.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      // space.on(RoomEvent.TrackSub)
      // 监听本地用户开关摄像头事件 ----------------------------------------------------------------------
      const onTrackHandler = (track: TrackPublication) => {
        if (track.source === Track.Source.Camera) {
          // 需要判断虚拟形象是否开启，若开启则需要关闭
          if (
            uState.virtual.enabled ||
            settings.participants[space.localParticipant.identity]?.virtual.enabled
          ) {
            updateSettings({
              virtual: {
                ...uState.virtual,
                enabled: false,
              },
            }).then(() => {
              socket.emit('update_user_status', {
                space: space.name,
              } as WsBase);
            });
          }
        }
      };

      // [用户定义新状态] ----------------------------------------------------------------------
      socket.on(
        'new_user_status_response',
        (msg: { status: UserDefineStatus[]; space: string }) => {
          if (space.name === msg.space) {
            setURoomStatusState(msg.status);
          }
        },
      );

      space.localParticipant.on(ParticipantEvent.TrackMuted, onTrackHandler);
      space.on(RoomEvent.ParticipantDisconnected, onParticipantDisConnected);

      // [用户邀请事件] -------------------------------------------------------------------------
      socket.on('invite_device_response', (msg: WsInviteDevice) => {
        if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
          let device_str;
          let open: () => Promise<LocalTrackPublication | undefined>;
          switch (msg.device) {
            case Track.Source.Camera:
              device_str = 'common.device.camera';
              open = () => space.localParticipant.setCameraEnabled(msg.isOpen);
              break;
            case Track.Source.Microphone:
              device_str = 'common.device.microphone';
              open = () => space.localParticipant.setMicrophoneEnabled(msg.isOpen);
              break;
            case Track.Source.ScreenShare:
              device_str = 'common.device.screen';
              open = () => space.localParticipant.setScreenShareEnabled(msg.isOpen);
              break;
            default:
              return;
          }

          const actions = (
            <Button
              type="primary"
              size="small"
              onClick={async () => {
                await open();
                noteApi.destroy();
              }}
            >
              {t(`common.${msg.isOpen ? 'open' : 'close'}`)}
            </Button>
          );

          noteApi.info({
            message: `${msg.senderName} ${t('msg.info.invite_device')} ${t(device_str)}`,
            duration: 5,
            actions,
          });
        }
      });
      // [用户被移除出房间] ----------------------------------------------------------------
      socket.on('remove_participant_response', async (msg: WsTo) => {
        if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
          let participant = space.localParticipant;
          messageApi.error({
            content: t('msg.info.remove_participant'),
            duration: 3,
          });
          space.disconnect(true);
          await onParticipantDisConnected(participant);
        }
      });
      // [用户控制事件] -------------------------------------------------------------------
      socket.on('control_participant_response', async (msg: WsControlParticipant) => {
        if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
          switch (msg.type) {
            case ControlType.ChangeName: {
              await space.localParticipant?.setMetadata(JSON.stringify({ name: msg.username! }));
              await space.localParticipant.setName(msg.username!);
              await updateSettings({
                name: msg.username!,
              });
              messageApi.success(t('msg.success.user.username.change'));
              socket.emit('update_user_status', {
                space: space.name,
              } as WsBase);
              break;
            }
            case ControlType.MuteAudio: {
              await space.localParticipant.setMicrophoneEnabled(false);
              messageApi.success(t('msg.success.device.mute.audio'));
              break;
            }
            case ControlType.MuteVideo: {
              await space.localParticipant.setCameraEnabled(false);
              messageApi.success(t('msg.success.device.mute.video'));
              break;
            }
            case ControlType.MuteScreen: {
              await space.localParticipant.setScreenShareEnabled(false);
              messageApi.success(t('msg.success.device.mute.screen'));
              break;
            }
            case ControlType.Transfer: {
              const success = await updateOwnerId(space.localParticipant.identity);
              if (success) {
                messageApi.success(t('msg.success.user.transfer'));
              }
              socket.emit('update_user_status', {
                space: space.name,
              } as WsBase);
              break;
            }
            case ControlType.Volume: {
              await updateSettings({
                volume: msg.volume!,
              });
              socket.emit('update_user_status', {
                space: space.name,
              } as WsBase);
              break;
            }
            case ControlType.BlurVideo: {
              await updateSettings({
                blur: msg.blur!,
              });
              socket.emit('update_user_status', {
                space: space.name,
              } as WsBase);
              break;
            }
            case ControlType.BlurScreen: {
              await updateSettings({
                screenBlur: msg.blur!,
              });
              socket.emit('update_user_status', {
                space: space.name,
              } as WsBase);
              break;
            }
          }
        }
      });
      // [参与者请求主持人录屏] ---------------------------------------------------
      socket.on('req_record_response', (msg: WsTo) => {
        if (msg.receiverId === space.localParticipant.identity && msg.space === space.name) {
          noteApi.info({
            message: `${msg.senderName} ${t('msg.info.req_record')}`,
            duration: 5,
          });
        }
      });
      // [主持人进行了录屏，询问参会者是否还要呆在房间] -----------------------------------
      socket.on('recording_response', (msg: WsBase) => {
        if (msg.space === space.name) {
          noteApi.warning({
            message: t('msg.info.recording'),
            actions: (
              <Button
                color="danger"
                size="small"
                onClick={async () => {
                  space.disconnect(true);
                }}
              >
                {t('common.leave')}
              </Button>
            ),
          });
        }
      });
      // [重新fetch room，这里有可能是因为房间初始化设置时出现问题] ------------------------
      socket.on(
        'refetch_room_response',
        async (msg: {
          space: string;
          reocrd: {
            active: boolean;
            egressId: string;
            filePath: string;
          };
        }) => {
          if (msg.space === space.name) {
            await updateSettings(
              settings.participants[space.localParticipant.identity],
              msg.reocrd,
            );
            socket.emit('update_user_status', {
              space: space.name,
            } as WsBase);
          }
        },
      );
      // [用户获取到其他参与者聊天信息事件] ------------------------------------------------
      socket.on('chat_msg_response', (msg: ChatMsgItem) => {
        if (msg.roomName === space.name) {
          setChatMsg((prev) => {
            if (controlsRef.current && controlsRef.current.isChatOpen) {
              return {
                unhandled: 0,
                msgs: [...prev.msgs, msg],
              };
            }

            return {
              unhandled: prev.unhandled + 1,
              msgs: [...prev.msgs, msg],
            };
          });
        }
      });

      socket.on('chat_file_response', (msg: ChatMsgItem) => {
        console.warn(msg);
        if (msg.roomName === space.name) {
          setChatMsg((prev) => {
            // 使用函数式更新来获取最新的 messages 状态
            const existingFile = prev.msgs.find((m) => m.id === msg.id);
            if (!existingFile) {
              let isOthers = msg.sender.id !== space.localParticipant.identity;
              return {
                unhandled: prev.unhandled + (isOthers ? 1 : 0),
                msgs: [...prev.msgs, msg],
              };
            }
            return prev; // 如果文件已存在，则不更新状态
          });
        }
      });

      // [重载/更新配置] -----------------------------------------------------------------------
      socket.on('reload_env_response', (msg: WsBase) => {
        messageApi.success(t('settings.general.conf.reload_env'));
        // 在localstorage中添加一个reload标记，这样退出之后如果有这个标记就可以自动重载
        localStorage.setItem('reload', space.name);
        space.disconnect(true);
      });

      // raise hand socket event ----------------------------------------------
      socket.on('raise_response', async (msg: WsSender) => {
        if (msg.space === space.name) {
          if (
            space.localParticipant.identity === settings.ownerId &&
            msg.senderId !== space.localParticipant.identity
          ) {
            await audio.raise();

            const wsTo: WsTo = {
              space: space.name,
              senderId: space.localParticipant.identity,
              senderName: space.localParticipant.name || space.localParticipant.identity,
              receiverId: msg.senderId,
              socketId: msg.senderSocketId!, // 这里一定是有这个senderSocketId的
            };

            noteApi?.info({
              message: `${msg.senderName} ${t('more.app.raise.receive')}`,
              duration: 5,
              actions: (
                <RaiseHandler
                  onAccept={() => acceptRaise(wsTo)}
                  onReject={() => rejectRaise(wsTo)}
                />
              ),
            });
          }
        }
      });

      const raiseHandle = async (msg: WsTo, isReject: boolean) => {
        if (msg.space === space.name && msg.receiverId === space.localParticipant.identity) {
          let msg = t('more.app.raise.handle.accepted');
          if (isReject) msg = t('more.app.raise.handle.rejected');
          messageApi.warning(msg);

          await updateSettings({
            raiseHand: false,
          });

          socket.emit('update_user_status', {
            space: space.name,
          } as WsBase);
        }
      };

      // cancel raise hand socket event ----------------------------------------------
      socket.on('raise_cancel_response', async (msg: WsTo) => {
        await raiseHandle(msg, true);
      });

      // accept raise hand socket event ----------------------------------------------
      socket.on('raise_accept_response', async (msg: WsTo) => {
        await raiseHandle(msg, false);
        // 为用户打开麦克风
        if (!space.localParticipant.isMicrophoneEnabled) {
          await space.localParticipant.setMicrophoneEnabled(true);
        }
      });

      return () => {
        socket.off('wave_response');
        socket.off('user_status_updated');
        socket.off('mouse_move_response');
        socket.off('mouse_remove_response');
        socket.off('new_user_status_response');
        socket.off('invite_device_response');
        socket.off('remove_participant_response');
        socket.off('control_participant_response');
        socket.off('req_record_response');
        socket.off('recording_response');
        socket.off('refetch_room_response');
        socket.off('chat_msg_response');
        socket.off('chat_file_response');
        socket.off('re_init_response');
        socket.off('connect');
        socket.off('reload_env_response');
        socket.off('raise_response');
        socket.off('raise_cancel_response');
        socket.off('raise_accept_response');
        space.off(RoomEvent.ParticipantConnected, onParticipantConnected);
        space.off(ParticipantEvent.TrackMuted, onTrackHandler);
        space.off(RoomEvent.ParticipantDisconnected, onParticipantDisConnected);
        // 组件卸载时，确保停止 AI 截屏服务并清除定时器
        try {
          aiCutServiceRef.current?.stop();
          aiCutServiceRef.current?.clearScreenshots();
        } catch (e) {
          // ignore
        }
        if (aiCutAnalysisIntervalId.current) {
          try {
            clearInterval(aiCutAnalysisIntervalId.current as unknown as number);
          } catch (e) {
            // ignore
          }
          aiCutAnalysisIntervalId.current = null;
        }
      };
    }, [
      space?.state,
      space?.localParticipant,
      uState,
      init,
      uLicenseState,
      chatMsg,
      socket,
      config,
      controlsRef,
      locale,
    ]);

    const selfRoom = useMemo(() => {
      if (!space || space.state !== ConnectionState.Connected) return;

      let selfRoom = settings.children.find((child) => {
        return child.participants.includes(space.localParticipant.identity);
      });

      let allChildParticipants = settings.children.reduce((acc, room) => {
        return acc.concat(room.participants);
      }, [] as string[]);

      if (!selfRoom) {
        // 这里还需要过滤掉进入子房间的参与者
        selfRoom = {
          name: space.name,
          participants: Object.keys(settings.participants).filter((pid) => {
            return !allChildParticipants.includes(pid);
          }),
          ownerId: settings.ownerId,
          isPrivate: false,
        };
      }
      return selfRoom;
    }, [settings.children, space]);

    useLayoutEffect(() => {
      if (!settings || !space || space.state !== ConnectionState.Connected) return;
      if (!freshPermission) return;
      // 发送一次fetchSettings请求，确保settings是最新的
      fetchSettings();
    }, [settings, space, freshPermission]);

    useEffect(() => {
      if (!space || space.state !== ConnectionState.Connected || !selfRoom) return;

      // 判断当前自己在哪个房间中，在不同的房间中设置不同用户的订阅权限
      // 订阅规则:
      // 1. 当用户在主房间时，可以订阅所有参与者的视频轨道，但不能订阅子房间用户的音频轨道
      // 2. 当用户在子房间时，可以订阅该子房间内的所有参与者的视频和音频轨道，包括主房间的参与者的视频轨道，但不能订阅主房间参与者的音频轨道
      let auth = [] as ParticipantTrackPermission[];
      // 远程参与者不在同一房间内，只订阅视频轨道
      let videoTrackSid = space.localParticipant.getTrackPublication(Track.Source.Camera)?.trackSid;

      let shareTackSid = space.localParticipant.getTrackPublication(
        Track.Source.ScreenShare,
      )?.trackSid;

      let allowedTrackSids = [];
      if (videoTrackSid) {
        allowedTrackSids.push(videoTrackSid);
      }
      if (shareTackSid) {
        allowedTrackSids.push(shareTackSid);
      }
      // 遍历所有的远程参与者，根据规则进行处理
      space.remoteParticipants.forEach((rp) => {
        // 由于我们已经可以从selfRoom中获取当前用户所在的房间信息，所以通过selfRoom进行判断
        if (selfRoom.participants.includes(rp.identity)) {
          auth.push({
            participantIdentity: rp.identity,
            allowAll: true,
          });
          let volume = settings.participants[rp.identity]?.volume / 100.0;
          if (isNaN(volume)) {
            volume = 1.0;
          }
          rp.setVolume(volume);
        } else {
          auth.push({
            participantIdentity: rp.identity,
            allowAll: false,
            allowedTrackSids,
          });
        }
      });

      // 设置房间订阅权限 ------------------------------------------------
      space.localParticipant.setTrackSubscriptionPermissions(false, auth);
      if (freshPermission) {
        fetchSettings().then(() => {
          setFreshPermission(false);
        });
        socket.emit('update_user_status', {
          space: space.name,
        } as WsBase);
      }
    }, [space, settings, selfRoom, freshPermission]);

    useEffect(() => {
      if (!space || space.state !== ConnectionState.Connected || !settings) return;
      // 同步settings中当前参与者的数据到uState中 -----------------------------------------------------
      if (settings.participants[space.localParticipant.identity]) {
        setUState((prev) => {
          let newState = {
            ...prev,
            ...settings.participants[space.localParticipant.identity],
          };
          // 同步后还需要设置到localStorage中
          localStorage.setItem(PARTICIPANT_SETTINGS_KEY, JSON.stringify(newState));
          return newState;
        });
      }
    }, [space, settings]);

    const [widgetState, setWidgetState] = React.useState<WidgetState>({
      showChat: false,
      unreadMessages: 0,
      showSettings: false,
    });
    const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);
    // [track] -----------------------------------------------------------------------------------------------------
    const originTracks = useTracks(
      [
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
      ],
      { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
    );

    const tracks = useMemo(() => {
      if (!selfRoom) return originTracks;
      // 过滤参与者轨道，只身下selfRoom中的参与者的轨道
      const roomTracks = originTracks.filter((track) =>
        selfRoom.participants.includes(track.participant.identity),
      );

      return roomTracks;
    }, [originTracks, selfRoom]);

    // [widget update and layout adjust] --------------------------------------------------------------------------
    const widgetUpdate = (state: WidgetState) => {
      if (cacheWidgetState && cacheWidgetState == state) {
        return;
      } else {
        setCacheWidgetState(state);
        setWidgetState(state);
      }
    };

    const layoutContext = useCreateLayoutContext();

    const screenShareTracks = tracks
      .filter(isTrackReference)
      .filter((track) => track.publication.source === Track.Source.ScreenShare);

    const focusTrack = usePinnedTracks(layoutContext)?.[0];
    const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

    React.useEffect(() => {
      // If screen share tracks are published, and no pin is set explicitly, auto set the screen share.
      if (
        screenShareTracks.some((track) => track.publication.isSubscribed) &&
        lastAutoFocusedScreenShareTrack.current === null
      ) {
        setIsFocus(true);
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
        lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
      } else if (
        lastAutoFocusedScreenShareTrack.current &&
        !screenShareTracks.some(
          (track) =>
            track.publication.trackSid ===
            lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
        )
      ) {
        layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
        lastAutoFocusedScreenShareTrack.current = null;
      }
      if (focusTrack && !isTrackReference(focusTrack)) {
        const updatedFocusTrack = tracks.find(
          (tr) =>
            tr.participant.identity === focusTrack.participant.identity &&
            tr.source === focusTrack.source,
        );
        if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
          layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack });
        }
      }
    }, [
      screenShareTracks
        .map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
        .join(),
      focusTrack?.publication?.trackSid,
      tracks,
    ]);

    const toSettingGeneral = (isDefineStatus?: boolean) => {
      controlsRef.current?.openSettings('general', isDefineStatus);
    };
    // [room update handler] --------------------------------------------------------------------------------------
    const handleUpdateRoom = async () => {
      await fetchSettings();
      // 需要更新用户视图Layout，因为发现在focus layout下切换房间会导致视图没有更新，依然看到上一个房间的视图
      if (focusTrack) {
        layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      }

      // 通知其他参与者更新用户状态
      if (space) {
        socket.emit('update_user_status', {
          space: space.name,
        } as WsBase);
      }
    };

    // [user status] ------------------------------------------------------------------------------------------
    const setUserStatus = async (status: UserStatus | string) => {
      let newStatus = {
        status,
      };
      switch (status) {
        case UserStatus.Online: {
          if (space) {
            space.localParticipant.setMicrophoneEnabled(true);
            space.localParticipant.setCameraEnabled(true);
            space.localParticipant.setScreenShareEnabled(false);
            if (uState.volume == 0) {
              const newVolume = 80;
              Object.assign(newStatus, { volume: newVolume });
            }
          }
          break;
        }
        case UserStatus.Leisure: {
          Object.assign(newStatus, { blur: 0.15, screenBlur: 0.15 });
          break;
        }
        case UserStatus.Busy: {
          Object.assign(newStatus, { blur: 0.15, screenBlur: 0.15, volume: 0 });
          break;
        }
        case UserStatus.Offline: {
          if (space) {
            space.localParticipant.setMicrophoneEnabled(false);
            space.localParticipant.setCameraEnabled(false);
            space.localParticipant.setScreenShareEnabled(false);
          }
          break;
        }
        default: {
          if (space) {
            const statusSettings = uRoomStatusState.find((item) => item.id === status);
            if (statusSettings) {
              Object.assign(newStatus, {
                volume: statusSettings.volume,
                blur: statusSettings.blur,
                screenBlur: statusSettings.screenBlur,
              });
            }
          }
          break;
        }
      }
      await updateSettings(newStatus);
      if (space) {
        socket.emit('update_user_status', {
          space: space.name,
        } as WsBase);
      }
    };

    const clearRoom = async () => {
      // 退出是设置init为true
      setInit(true);
    };

    const showFlot = useMemo(() => {
      return !isMobile() ? true : collapsed;
    }, [collapsed]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      // 如果拖拽的文件数量大于0，则表示是文件拖拽，如果文件拖拽就需要让<Controls />组件开启聊天的Drawer
      if (e.dataTransfer.files.length > 0) {
        if (controlsRef.current) {
          controlsRef.current.setChatOpen(true);
        }
      }
    };
    const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (controlsRef.current) {
        controlsRef.current.setChatOpen(true);
      }
    };

    useImperativeHandle(ref, () => ({
      clearRoom: () => clearRoom(),
    }));

    return (
      <div
        className="video_container_wrapper"
        style={{ position: 'relative' }}
        onDragEnter={handleDrag}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* 右侧应用浮窗，悬浮态 */}
        {showFlot && space && settings.participants[space.localParticipant.identity] && (
          <FlotButton
            openApp={openApp}
            setOpenApp={setOpenApp}
            style={{ position: 'absolute', top: '50px', right: '0px', zIndex: 1111 }}
          ></FlotButton>
        )}
        {showFlot && space && settings.participants[space.localParticipant.identity] && (
          <FlotLayout
            space={space.name}
            messageApi={messageApi}
            openApp={openApp}
            spaceInfo={settings}
            setOpenApp={setOpenApp}
            showAICutAnalysisSettings={controlsRef.current?.showAICutAnalysisSettings}
            reloadResult={reloadResult}
            aiCutAnalysisRes={aiCutAnalysisRes}
            startOrStopAICutAnalysis={startOrStopAICutAnalysis}
            openAIServiceAskNote={openAIServiceAskNote}
            cutInstance={aiCutServiceRef.current}
            updateSettings={updateSettings}
          ></FlotLayout>
        )}
        {/* 左侧侧边栏 */}
        {space && (
          <Channel
            ref={channelRef}
            config={config}
            space={space}
            localParticipantId={space.localParticipant.identity}
            settings={settings}
            onUpdate={handleUpdateRoom}
            tracks={originTracks}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            messageApi={messageApi}
            isActive={isActive}
            updateSettings={updateSettings}
            toRenameSettings={toSettingGeneral}
            setUserStatus={setUserStatus}
            showFlotApp={showFlotApp}
          ></Channel>
        )}
        {/* 主视口 */}
        <div
          className="lk-video-conference"
          {...props}
          style={{
            height: '100vh',
            transition: 'width 0.3s ease-in-out',
            width: collapsed ? (isActive ? 'calc(100vw - 28px)' : '100vw') : 'calc(100vw - 280px)',
          }}
        >
          {space && (
            <LayoutContextProvider
              value={layoutContext}
              // onPinChange={handleFocusStateChange}
              onWidgetChange={widgetUpdate}
            >
              <div
                className="lk-video-conference-inner"
                style={{ alignItems: 'space-between', height: '100dvh' }}
              >
                {!focusTrack ? (
                  <div className="lk-grid-layout-wrapper">
                    <GridLayout tracks={tracks}>
                      <ParticipantItem
                        space={space}
                        settings={settings}
                        toSettings={toSettingGeneral}
                        messageApi={messageApi}
                        noteApi={noteApi}
                        setUserStatus={setUserStatus}
                        updateSettings={updateSettings}
                        toRenameSettings={toSettingGeneral}
                        showFlotApp={showFlotApp}
                        selfRoom={selfRoom}
                      ></ParticipantItem>
                    </GridLayout>
                  </div>
                ) : (
                  <div className="lk-focus-layout-wrapper">
                    <FocusLayoutContainer>
                      <CarouselLayout tracks={carouselTracks}>
                        <ParticipantItem
                          space={space}
                          settings={settings}
                          toSettings={toSettingGeneral}
                          messageApi={messageApi}
                          noteApi={noteApi}
                          setUserStatus={setUserStatus}
                          updateSettings={updateSettings}
                          toRenameSettings={toSettingGeneral}
                          showFlotApp={showFlotApp}
                          selfRoom={selfRoom}
                        ></ParticipantItem>
                      </CarouselLayout>
                      {focusTrack && (
                        <ParticipantItem
                          space={space}
                          setUserStatus={setUserStatus}
                          settings={settings}
                          toSettings={toSettingGeneral}
                          trackRef={focusTrack}
                          messageApi={messageApi}
                          noteApi={noteApi}
                          isFocus={isFocus}
                          updateSettings={updateSettings}
                          toRenameSettings={toSettingGeneral}
                          showFlotApp={showFlotApp}
                          selfRoom={selfRoom}
                        ></ParticipantItem>
                      )}
                    </FocusLayoutContainer>
                  </div>
                )}
                <Controls
                  ref={controlsRef}
                  setUserStatus={setUserStatus}
                  controls={{ chat: true, settings: !!SettingsComponent }}
                  updateSettings={updateSettings}
                  spaceInfo={settings}
                  fetchSettings={fetchSettings}
                  updateRecord={updateRecord}
                  setPermissionDevice={setPermissionDevice}
                  collapsed={collapsed}
                  setCollapsed={setCollapsed}
                  openApp={openApp}
                  setOpenApp={setOpenApp}
                  toRenameSettings={toSettingGeneral}
                  startOrStopAICutAnalysis={startOrStopAICutAnalysis}
                  openAIServiceAskNote={openAIServiceAskNote}
                ></Controls>
              </div>
              {SettingsComponent && (
                <div
                  className="lk-settings-menu-modal"
                  style={{ display: widgetState.showSettings ? 'block' : 'none' }}
                >
                  <SettingsComponent />
                </div>
              )}
            </LayoutContextProvider>
          )}
          <RoomAudioRenderer />
          <ConnectionStateToast />
          <audio
            ref={waveAudioRef}
            style={{ display: 'none' }}
            src={src('/audios/vocespacewave.m4a')}
          ></audio>
          <audio
            ref={promptSoundRef}
            style={{ display: 'none' }}
            src={src('/audios/prompt.mp3')}
          ></audio>
        </div>
      </div>
    );
  },
);

export function isEqualTrackRef(
  a?: TrackReferenceOrPlaceholder,
  b?: TrackReferenceOrPlaceholder,
): boolean {
  if (a === undefined || b === undefined) {
    return false;
  }
  if (isTrackReference(a) && isTrackReference(b)) {
    return a.publication.trackSid === b.publication.trackSid;
  } else {
    return getTrackReferenceId(a) === getTrackReferenceId(b);
  }
}

export function getTrackReferenceId(trackReference: TrackReferenceOrPlaceholder | number) {
  if (typeof trackReference === 'string' || typeof trackReference === 'number') {
    return `${trackReference}`;
  } else if (isTrackReferencePlaceholder(trackReference)) {
    return `${trackReference.participant.identity}_${trackReference.source}_placeholder`;
  } else if (isTrackReference(trackReference)) {
    return `${trackReference.participant.identity}_${trackReference.publication.source}_${trackReference.publication.trackSid}`;
  } else {
    throw new Error(`Can't generate a id for the given track reference: ${trackReference}`);
  }
}

export function isTrackReferencePlaceholder(
  trackReference?: TrackReferenceOrPlaceholder,
): trackReference is TrackReferencePlaceholder {
  if (!trackReference) {
    return false;
  }
  return (
    trackReference.hasOwnProperty('participant') &&
    trackReference.hasOwnProperty('source') &&
    typeof trackReference.publication === 'undefined'
  );
}

export type TrackReferenceOrPlaceholder = TrackReference | TrackReferencePlaceholder;

export type TrackReferencePlaceholder = {
  participant: Participant;
  publication?: never;
  source: Track.Source;
};
