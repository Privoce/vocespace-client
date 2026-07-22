import { isMobile, src, UserDefineStatus, UserStatus } from '@/lib/std';
import {
  ConnectionStateToast,
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
import { ParticipantItem } from '../participant/tile';
import { useSpaceInfo } from '@/lib/hooks/space';
import { MessageInstance } from 'antd/es/message/interface';
import { NotificationInstance } from 'antd/es/notification/interface';
import { useI18n } from '@/lib/i18n/i18n';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { useUserStore, useLicenseStore, useRoomStore, useSpaceStore } from '@/lib/store';
import { useUserStatus, useRoomLicense, useRoomSubscription } from './hooks/index';
import { useAICutService } from './hooks/use-ai-cut';
import {
  ControlType,
  WsBase,
  WsControlParticipant,
  WsInviteDevice,
  WsParticipant,
  WsSender,
  WsTilePlayer,
  WsTo,
  WsWave,
} from '@/lib/std/device';
import { Button } from 'antd';
import { ChatMsgItem } from '@/lib/std/chat';
import { Channel, ChannelExports } from './channel';
import { AppAuth, PARTICIPANT_SETTINGS_KEY } from '@/lib/std/space';
import { FlotButton, FlotLayout, FlotLayoutExports } from '../apps/flot';
import { api } from '@/lib/api';
import { analyzeLicense, getLicensePersonLimit, validLicenseDomain } from '@/lib/std/license';
import { ReadableConf } from '@/lib/std/conf';
import { acceptRaise, RaiseHandler, rejectRaise } from './widgets/raise';
import { audio } from '@/lib/audio';
import { useFullScreenBtn } from './widgets/full_screen';
import { exportRBAC, usePlatformUserInfo, usePlatformUserInfoCheap } from '@/lib/hooks/platform';
import { markExplicitLeaveIntent } from '@/lib/roomLeaveIntent';
import { TilePlayer, TilePlayerAdd, TilePlayerItem } from '../participant/player';
import { LayoutEntity, UnifiedLayout, useReplaceLivekitTrack } from '../layout/unified';
import { PaginationControl, PaginationIndicator } from '../layout/cover';
import { LicenseAlert } from './widgets/license_alert';
import { ChatPanel } from '@/app/pages/chat/chat';
import { useControlsChat } from './hooks';

export interface VideoContainerProps extends VideoConferenceProps {
  messageApi: MessageInstance;
  noteApi: NotificationInstance;
  setPermissionDevice: (device: Track.Source) => void;
  config: ReadableConf;
}

export interface VideoContainerExports {
  clearRoom: () => Promise<void>;
}

type VideoLayoutEntity = LayoutEntity<TrackReferenceOrPlaceholder | React.ReactNode> & {
  category: 'track' | 'tile-player' | 'tile-player-add';
};

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
    const FlotLayoutRef = useRef<FlotLayoutExports>(null);
    const [init, setInit] = useState(true);
    const { t, locale } = useI18n();
    const isFullScreen = useSpaceStore((s) => s.isFullScreen);
    const setIsFullScreen = useSpaceStore((s) => s.setIsFullScreen);
    const isFocus = useSpaceStore((s) => s.isFocus);
    const setIsFocus = useSpaceStore((s) => s.setIsFocus);
    const uState = useUserStore();
    const collapsed = useSpaceStore((s) => s.collapsed);
    const deviceType = useSpaceStore((s) => s.deviceType);
    const uLicenseState = useLicenseStore();
    const { hasRoomLicense, toBuyRoomLicense } = useRoomLicense(config, space, messageApi);

    const controlsRef = React.useRef<ControlBarExport>(null);
    const waveAudioRef = React.useRef<HTMLAudioElement>(null);
    const promptSoundRef = React.useRef<HTMLAudioElement>(null);
    const [freshPermission, setFreshPermission] = useState(false);
    const [localTrackVersion, setLocalTrackVersion] = useState(0);
    const [cacheWidgetState, setCacheWidgetState] = useState<WidgetState>();
    const chatMsg = useRoomStore((s) => s.chatMsg);
    const { chatOpen, setChatOpen, sendFileConfirm } = useControlsChat();
    const channelRef = React.useRef<ChannelExports>(null);
    const {
      settings,
      updateSettings,
      fetchSettings,
      clearSettings,
      transOrSetOwnerManager,
      updateRecord,
    } = useSpaceInfo(
      space?.name || '', // 房间 ID
      space?.localParticipant?.identity || '', // 参与者 ID
    );
    // console.warn(settings);
    const { fromVocespace, platUser, roomEnter, showAI } = usePlatformUserInfo({
      space,
      uid: space?.localParticipant.identity,
      onEnterRoom: () => {
        socket.emit('update_user_status', {
          space: space!.name,
        } as WsBase);
      },
    });
    const showSideChannel = useMemo(() => {
      if (!space) return false;
      return exportRBAC(space?.localParticipant.identity, settings).viewRoom;
    }, [space, settings]);
    const [openApp, setOpenApp] = useState<boolean>(false);
    const isActive = true;
    const showFlotApp = (id?: string, participantName?: string, auth?: AppAuth) => {
      useRoomStore.getState().setRemoteApp({
        participantId: id,
        participantName,
        auth: auth || 'read',
      });
      setOpenApp(!openApp);
    };

    const {
      aiCutServiceRef,
      aiCutAnalysisRes,
      noteStateForAICutService,
      setNoteStateForAICutService,
      startOrStopAICutAnalysis,
      stopAICutService,
      openAIServiceAskNote,
      reloadResult,
      fetchPlatformData,
    } = useAICutService({
      space,
      settings,
      uState,
      messageApi,
      noteApi,
      fromVocespace,
      updateSettings,
      locale,
    });

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

      // 从平台端获取数据 ai总结/todos (moved to useAICutService hook)
      const syncSettings = async () => {
        const todos = await fetchPlatformData(fromVocespace);
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

      // 获取历史聊天记录 ---------------------------------------------------------------------------
      const fetchChatMsg = async () => {
        const response = await api.getChatMsg(space.name);
        if (response.ok) {
          const { msgs }: { msgs: ChatMsgItem[] } = await response.json();
          let othersMsgLength = msgs.filter(
            (msg) => msg.id !== space.localParticipant.identity,
          ).length;
          useRoomStore.getState().setChatMsg((prev) => ({
            unhandled: prev.unhandled + othersMsgLength,
            msgs: [...prev.msgs, ...msgs],
          }));
        } else {
          console.error('Failed to fetch chat messages:', response.statusText);
        }
      };

      // 从config中获取license进行校验 -------------------------------------------------------------------
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
            space.disconnect(true);
            return;
          }

          useLicenseStore.setState({
            space: {
              ...license,
              isAnalysis: true,
              personLimit: getLicensePersonLimit(license.limit, license.isTmp),
            },
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
        if (space.remoteParticipants.size >= uLicenseState.space.personLimit - 1) {
          if (space.localParticipant.identity === participant.identity) {
            messageApi.error({
              content: t('common.full_user'),
              duration: 3,
            });
            markExplicitLeaveIntent();
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
            useRoomStore.getState().setRoomStatusList(msg.status);
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
          markExplicitLeaveIntent();
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
              const success = await transOrSetOwnerManager(
                msg.senderId,
                space.localParticipant.identity,
                true,
              );
              if (success) {
                // 更新视图
                layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
                messageApi.success(t('msg.success.user.transfer'));
              }
              socket.emit('update_user_status', {
                space: space.name,
              } as WsBase);
              break;
            }
            case ControlType.setManager: {
              if (settings.managers.length < 5) {
                const { success, isRemove } = await transOrSetOwnerManager(
                  msg.senderId,
                  space.localParticipant.identity,
                  false,
                );
                if (success) {
                  layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
                  if (isRemove) {
                    messageApi.success(t('msg.success.user.remove_manager'));
                  } else {
                    messageApi.success(t('msg.success.user.set_manager'));
                  }
                }
                socket.emit('update_user_status', {
                  space: space.name,
                } as WsBase);
              } else {
                messageApi.error(t('msg.error.user.manager_limit'));
              }
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
                  markExplicitLeaveIntent();
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
          useRoomStore.getState().setChatMsg((prev) => {
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
          useRoomStore.getState().setChatMsg((prev) => {
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
        markExplicitLeaveIntent();
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
      platUser,
    ]);

    const selfRoom = useMemo(() => {
      if (!space || space.state !== ConnectionState.Connected || !settings || !settings.children)
        return;

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
    }, [settings, space]);

    const [tilePlayerItems, setTilePlayerItems] = useState<TilePlayerItem[]>([]);

    const fetchTilePlayers = useCallback(async () => {
      if (!space?.name || !selfRoom) return;
      try {
        const response = await api.handleTilePlayerFile(
          space.name,
          selfRoom.name,
          'ls',
          undefined,
          undefined,
          space.localParticipant.identity,
        );
        if (response.ok) {
          const data = await response.json();
          setTilePlayerItems(Array.isArray(data.players) ? data.players : []);
        }
      } catch (e) {
        console.error('fetchTilePlayers error:', e);
      }
    }, [space?.name, selfRoom?.name]);

    useEffect(() => {
      fetchTilePlayers();
    }, [fetchTilePlayers]);

    useEffect(() => {
      // tile player change socket event
      const handleTilePlayerChange = (msg: WsTilePlayer) => {
        if (msg.participantId === space?.localParticipant.identity) return;
        if (space && msg.space === space.name) {
          fetchTilePlayers();
          fetchSettings();
        }
      };
      socket.on('tile_player_change_response', handleTilePlayerChange);
      return () => {
        socket.off('tile_player_change_response', handleTilePlayerChange);
      };
    }, [space, fetchTilePlayers]);

    useLayoutEffect(() => {
      if (!settings || !space || space.state !== ConnectionState.Connected) return;
      if (!freshPermission) return;
      // 发送一次fetchSettings请求，确保settings是最新的
      fetchSettings();
    }, [settings, space, freshPermission]);

    useRoomSubscription({
      space,
      settings,
      selfRoom,
      freshPermission,
      localTrackVersion,
      fetchSettings,
    });

    // 监听本地轨道发布/取消发布事件，重新触发订阅权限计算
    useEffect(() => {
      if (!space) return;
      const onLocalTrackChange = () => {
        setLocalTrackVersion((v) => v + 1);
      };
      space.localParticipant.on(ParticipantEvent.LocalTrackPublished, onLocalTrackChange);
      space.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, onLocalTrackChange);
      return () => {
        space.localParticipant.off(ParticipantEvent.LocalTrackPublished, onLocalTrackChange);
        space.localParticipant.off(ParticipantEvent.LocalTrackUnpublished, onLocalTrackChange);
      };
    }, [space]);

    useEffect(() => {
      if (!space || space.state !== ConnectionState.Connected || !settings) return;
      // 同步settings中当前参与者的数据到uState中 -----------------------------------------------------
      if (settings.participants[space.localParticipant.identity]) {
        useUserStore.setState((prev) => {
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

      // roomTracks.push(FakeParticipantTrack(selfRoom.name)); // todo

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
    const focusedTilePlayerId = useMemo(() => {
      if (!space?.name || !focusTrack || focusTrack.source !== Track.Source.Unknown) return null;

      const participantName = focusTrack.participant.name || focusTrack.participant.identity;
      const prefix = `${space.name}_player_`;
      return participantName.startsWith(prefix) ? participantName.slice(prefix.length) : null;
    }, [
      focusTrack?.participant.identity,
      focusTrack?.participant.name,
      focusTrack?.source,
      space?.name,
    ]);
    const isTilePlayerFocused = !!focusedTilePlayerId;

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
        setIsFocus(false);
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
      controlsRef.current?.openSettings('profile', isDefineStatus);
    };
    // [room update handler] --------------------------------------------------------------------------------------
    const handleUpdateRoom = async () => {
      await fetchSettings();
      // 需要更新用户视图Layout，因为发现在focus layout下切换房间会导致视图没有更新，依然看到上一个房间的视图
      if (focusTrack) {
        layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
        setIsFocus(false);
      }

      // 通知其他参与者更新用户状态
      if (space) {
        socket.emit('update_user_status', {
          space: space.name,
        } as WsBase);
      }
    };

    // [user status] ------------------------------------------------------------------------------------------
    const { setUserStatus } = useUserStatus(space, updateSettings);

    const clearRoom = async () => {
      // 退出是设置init为true
      setInit(true);
    };

    const showFlot = useMemo(() => {
      return deviceType === 'desktop' ? true : collapsed;
    }, [collapsed, deviceType]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files.length > 0) {
        setChatOpen(true);
      }
    };
    const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setChatOpen(true);
    };

    const mainViewWidth = useMemo(() => {
      return !showSideChannel
        ? '100vw'
        : collapsed
          ? isActive
            ? 'calc(100vw - 28px)'
            : '100vw'
          : 'calc(100vw - 280px)';
    }, [collapsed, showSideChannel, isActive]);

    const { entities: trackEntities, focusEntity: focusedTrackEntity } = useReplaceLivekitTrack<
      TrackReferenceOrPlaceholder,
      VideoLayoutEntity
    >({
      tracks,
      focusTrack: focusTrack ?? null,
      getTrackId: (track) => getTrackReferenceIdSafe(track),
      mapTrackToEntity: (track, id) => ({
        id,
        category: 'track',
        type: 'participant',
        source: `${track.source ?? track.publication?.source ?? Track.Source.Unknown}`,
        label: track.participant?.identity,
        payload: track,
      }),
      appendFocusTrack: !isTilePlayerFocused,
    });

    const tilePlayerEntities = useMemo((): VideoLayoutEntity[] => {
      if (!space?.name || !selfRoom) return [];

      const entities: VideoLayoutEntity[] = [
        {
          id: 'tile-player:add',
          category: 'tile-player-add',
          type: 'tile-player-add',
          label: 'tile-player-add',
          payload: (
            <TilePlayerAdd
              key="__add__"
              spaceName={space.name}
              room={selfRoom.name}
              myIdentity={space.localParticipant.identity}
              messageApi={messageApi}
              onCreated={() => {
                fetchTilePlayers();
                fetchSettings();
              }}
              iframeUrls={settings.iframeUrls}
            />
          ),
        },
      ];

      tilePlayerItems.forEach((item) => {
        const isFocused = focusedTilePlayerId === item.id;
        const playerNode = (
          <TilePlayer
            spaceInfo={settings}
            key={item.id}
            item={item}
            spaceName={space.name}
            room={selfRoom.name}
            myIdentity={space.localParticipant.identity}
            messageApi={messageApi}
            focus={isFocused}
            afterFocus={(focus) => {
              if (focus) {
                layoutContext?.pin.dispatch?.({
                  msg: 'set_pin',
                  trackReference: newPlayerTrack(space.name, item.id),
                });
              } else {
                layoutContext?.pin.dispatch?.({
                  msg: 'clear_pin',
                });
              }
            }}
            onRemoved={fetchTilePlayers}
          />
        );

        entities.push({
          id: `tile-player:${item.id}`,
          category: 'tile-player',
          type: 'tile-player',
          label: item.id,
          payload: playerNode,
        });
      });

      return entities;
    }, [
      fetchTilePlayers,
      focusedTilePlayerId,
      isFullScreen,
      layoutContext,
      messageApi,
      selfRoom,
      setIsFullScreen,
      settings,
      space?.localParticipant.identity,
      space?.name,
      tilePlayerItems,
    ]);

    const focusedTilePlayerEntity = useMemo(() => {
      if (!focusedTilePlayerId) return null;
      return (
        tilePlayerEntities.find((entity) => entity.id === `tile-player:${focusedTilePlayerId}`) ??
        null
      );
    }, [focusedTilePlayerId, tilePlayerEntities]);

    const unifiedEntities = useMemo(
      () => [...trackEntities, ...tilePlayerEntities],
      [tilePlayerEntities, trackEntities],
    );

    const unifiedFocusEntity = isTilePlayerFocused ? focusedTilePlayerEntity : focusedTrackEntity;

    const unifiedPageSize = useMemo(() => {
      if (isTilePlayerFocused || focusedTrackEntity) {
        return isMobile() ? 4 : 5;
      }
      return isMobile() ? 4 : 9;
    }, [focusedTrackEntity, isTilePlayerFocused]);

    const renderUnifiedEntity = useCallback(
      (entity: VideoLayoutEntity, state: { isFocus: boolean }) => {
        if (entity.category === 'track') {
          return (
            <ParticipantItem
              trackRef={entity.payload as TrackReferenceOrPlaceholder}
              space={space!}
              settings={settings}
              toSettings={toSettingGeneral}
              messageApi={messageApi}
              noteApi={noteApi}
              setUserStatus={setUserStatus}
              updateSettings={updateSettings}
              toRenameSettings={toSettingGeneral}
              showFlotApp={showFlotApp}
              selfRoom={selfRoom}
              isFocus={state.isFocus || isFocus}
            />
          );
        }

        return entity.payload as React.ReactNode;
      },
      [
        isFocus,
        isFullScreen,
        messageApi,
        noteApi,
        selfRoom,
        setIsFullScreen,
        setUserStatus,
        settings,
        showFlotApp,
        space,
        toSettingGeneral,
        updateSettings,
      ],
    );

    useEffect(() => {
      if (!focusedTilePlayerId) return;
      if (tilePlayerItems.some((item) => item.id === focusedTilePlayerId)) return;

      layoutContext?.pin.dispatch?.({
        msg: 'clear_pin',
      });
    }, [focusedTilePlayerId, tilePlayerItems, layoutContext]);

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
            style={{ position: 'absolute', top: '30px', right: '0px', zIndex: 1111 }}
          ></FlotButton>
        )}
        {showFlot && space && settings.participants[space.localParticipant.identity] && (
          <FlotLayout
            showAI={showAI}
            ref={FlotLayoutRef}
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
        {space && showSideChannel && (
          <Channel
            ref={channelRef}
            config={config}
            space={space}
            localParticipantId={space.localParticipant.identity}
            settings={settings}
            onUpdate={handleUpdateRoom}
            tracks={originTracks}
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
            width: mainViewWidth,
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
                style={{
                  alignItems: 'flex-start',
                  height: '100dvh',
                  gap: 8,
                  flexDirection: 'column',
                }}
              >
                {!hasRoomLicense && (
                  <LicenseAlert toBuyRoomLicense={toBuyRoomLicense}></LicenseAlert>
                )}
                <div style={{ display: 'flex', flex: 1, width: '100%', minHeight: 0 }}>
                  <div
                    className={focusTrack ? 'lk-focus-layout-wrapper' : 'lk-grid-layout-wrapper'}
                    style={{
                      position: 'relative',
                      flex: 1,
                      minHeight: 0,
                      height: '100%',
                      width: chatOpen ? 'calc(100% - 288px)' : '100%',
                      padding: '0px 0px 0px 8px',
                      marginBottom: 0,
                      transition: 'width 0.3s ease-in-out',
                    }}
                  >
                    <UnifiedLayout
                      entities={unifiedEntities}
                      focusEntity={unifiedFocusEntity}
                      layoutType={unifiedFocusEntity ? 'focus' : 'grid'}
                      deviceType={deviceType}
                      fullScreen={isFullScreen}
                      pageSize={unifiedPageSize}
                      preserveOffscreen
                      className="lk-unified-layout-stage"
                      style={{ width: '100%', height: '100%' }}
                      renderEntity={renderUnifiedEntity}
                      renderOverlay={({ currentPage, totalPages, nextPage, prevPage }) => {
                        if (totalPages <= 1) return null;

                        return (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 12,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              zIndex: 30,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <PaginationIndicator
                              totalPageCount={totalPages}
                              currentPage={currentPage}
                            />
                            <PaginationControl
                              totalPageCount={totalPages}
                              currentPage={currentPage}
                              nextPage={nextPage}
                              prevPage={prevPage}
                            />
                          </div>
                        );
                      }}
                    />
                  </div>
                  {!isMobile() && (
                    <div
                      style={{
                        width: chatOpen ? 280 : 0,
                        height: '100%',
                        overflow: 'hidden',
                        transition: 'width 0.3s ease-in-out',
                        flexShrink: 0,
                        borderLeft: '1px dashed #8f8f8f',
                        borderRadius: '0.5em',
                      }}
                    >
                      {chatOpen && space && (
                        <ChatPanel
                          space={space}
                          sendFileConfirm={sendFileConfirm}
                          messageApi={messageApi}
                          spaceInfo={settings}
                        />
                      )}
                    </div>
                  )}
                </div>
                <Controls
                  ref={controlsRef}
                  setUserStatus={setUserStatus}
                  controls={{ chat: true, settings: !!SettingsComponent }}
                  updateSettings={updateSettings}
                  spaceInfo={settings}
                  fetchSettings={fetchSettings}
                  updateRecord={updateRecord}
                  setPermissionDevice={setPermissionDevice}
                  openApp={openApp}
                  setOpenApp={setOpenApp}
                  toRenameSettings={toSettingGeneral}
                  startOrStopAICutAnalysis={startOrStopAICutAnalysis}
                  openAIServiceAskNote={openAIServiceAskNote}
                  downloadAIMdReport={FlotLayoutRef.current?.downloadAIMdReport}
                  config={config}
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
  try {
    if (a === undefined || b === undefined) {
      return false;
    }

    if (isTrackReference(a) && isTrackReference(b)) {
      // publication may be undefined in some edge cases
      return (a.publication?.trackSid ?? '') === (b.publication?.trackSid ?? '');
    }

    const ida = getTrackReferenceIdSafe(a);
    const idb = getTrackReferenceIdSafe(b);
    if (!ida || !idb) return false;
    return ida === idb;
  } catch (e) {
    console.warn('isEqualTrackRef error', e);
    return false;
  }
}

export function getTrackReferenceIdSafe(
  trackReference?: TrackReferenceOrPlaceholder | number,
): string | undefined {
  if (trackReference === undefined || trackReference === null) return undefined;
  try {
    if (typeof trackReference === 'string' || typeof trackReference === 'number') {
      return `${trackReference}`;
    }

    if (isTrackReferencePlaceholder(trackReference)) {
      return `${trackReference.participant.identity}_${trackReference.source}_placeholder`;
    }

    if (isTrackReference(trackReference)) {
      const pid = trackReference.participant?.identity;
      const src = trackReference.publication?.source;
      const sid = trackReference.publication?.trackSid;
      if (!pid || !src || !sid) return undefined;
      return `${pid}_${src}_${sid}`;
    }
  } catch (e) {
    console.warn('getTrackReferenceIdSafe error', e);
    return undefined;
  }

  return undefined;
}

// Deprecated: compatibility wrapper for older callers
export function getTrackReferenceId(trackReference: TrackReferenceOrPlaceholder | number) {
  return getTrackReferenceIdSafe(trackReference) || `${trackReference}`;
}

export function isTrackReferencePlaceholder(
  trackReference?: TrackReferenceOrPlaceholder,
): trackReference is TrackReferencePlaceholder {
  if (!trackReference) return false;
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

const newPlayerTrack = (space: string, playerId: string): TrackReferenceOrPlaceholder => {
  const nameOrId = `${space}_player_${playerId}`;
  return {
    participant: new Participant(nameOrId, nameOrId, nameOrId),
    source: Track.Source.Unknown,
  } as TrackReferencePlaceholder;
};
