import {
  connect_endpoint,
  getServerIp,
  is_web,
  src,
  UserDefineStatus,
  UserStatus,
} from '@/lib/std';
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  isTrackReference,
  LayoutContextProvider,
  ParticipantPlaceholder,
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
  RoomEvent,
  Track,
  TrackPublication,
} from 'livekit-client';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { ControlBarExport, Controls } from './bar';
import { useRecoilState } from 'recoil';
import { ParticipantItem } from '../participant/tile';
import { useRoomSettings } from '@/lib/hooks/room_settings';
import { MessageInstance } from 'antd/es/message/interface';
import { NotificationInstance } from 'antd/es/notification/interface';
import { useI18n } from '@/lib/i18n/i18n';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import {
  chatMsgState,
  licenseState,
  roomStatusState,
  socket,
  userState,
} from '@/app/[roomName]/PageClientImpl';
import { useRouter } from 'next/navigation';
import { FocusCollapse } from './collapse';
import { ControlType, WsBase, WsControlParticipant, WsInviteDevice, WsTo } from '@/lib/std/device';
import { Button } from 'antd';
import { ChatMsgItem } from '@/lib/std/chat';
import { Channel } from './channel';
import { createRoom } from '@/lib/hooks/channel';
import { PARTICIPANT_SETTINGS_KEY } from '@/lib/std/room';
import { FlotLayout } from '../apps/flot';

export interface VideoContainerProps extends VideoConferenceProps {
  messageApi: MessageInstance;
  noteApi: NotificationInstance;
  setPermissionDevice: (device: Track.Source) => void;
}

export interface VideoContainerExports {
  removeLocalSettings: () => Promise<void>;
}
const CONNECT_ENDPOINT = connect_endpoint('/api/room-settings');
const IP = process.env.SERVER_NAME ?? getServerIp() ?? 'localhost';
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
      ...props
    }: VideoContainerProps,
    ref,
  ) => {
    const room = useMaybeRoomContext();
    const [init, setInit] = useState(true);
    const { t } = useI18n();
    const [uState, setUState] = useRecoilState(userState);
    const [collapsed, setCollapsed] = useState(false);
    const [uLicenseState, setULicenseState] = useRecoilState(licenseState);
    const controlsRef = React.useRef<ControlBarExport>(null);
    const waveAudioRef = React.useRef<HTMLAudioElement>(null);
    const promptSoundRef = React.useRef<HTMLAudioElement>(null);
    const [isFocus, setIsFocus] = useState(false);
    const [freshPermission, setFreshPermission] = useState(false);
    const [cacheWidgetState, setCacheWidgetState] = useState<WidgetState>();
    const [chatMsg, setChatMsg] = useRecoilState(chatMsgState);
    const [uRoomStatusState, setURoomStatusState] = useRecoilState(roomStatusState);
    const router = useRouter();
    const { settings, updateSettings, fetchSettings, clearSettings, updateOwnerId, updateRecord } =
      useRoomSettings(
        room?.name || '', // 房间 ID
        room?.localParticipant?.identity || '', // 参与者 ID
      );
    const [openApp, setOpenApp] = useState<boolean>(false);
    const isActive = true;

    useEffect(() => {
      if (!room || !socket.id) return;
      if (
        room.state === ConnectionState.Connecting ||
        room.state === ConnectionState.Reconnecting
      ) {
        setInit(true);
        return;
      } else if (room.state !== ConnectionState.Connected) {
        return;
      }

      const syncSettings = async () => {
        // 将当前参与者的基础设置发送到服务器 ----------------------------------------------------------
        await updateSettings({
          name: room.localParticipant.name || room.localParticipant.identity,
          blur: uState.blur,
          screenBlur: uState.screenBlur,
          volume: uState.volume,
          status: UserStatus.Online,
          socketId: socket.id,
          startAt: new Date().getTime(),
          virtual: {
            enabled: false,
            role: ModelRole.None,
            bg: ModelBg.ClassRoom,
          },
          openShareAudio: uState.openShareAudio,
          openPromptSound: uState.openPromptSound,
        });
        const roomName = `${room.localParticipant.name}'s room`;

        // 为新加入的参与者创建一个自己的私人房间
        if (!settings.children.some((child) => child.name === roomName)) {
          const response = await createRoom({
            hostRoom: room.name,
            roomName,
            ownerId: room.localParticipant.identity,
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
        const url = new URL(CONNECT_ENDPOINT, window.location.origin);
        url.searchParams.append('roomId', room.name);
        url.searchParams.append('chat_history', 'true');
        const response = await fetch(url.toString());
        if (response.ok) {
          const { msgs }: { msgs: ChatMsgItem[] } = await response.json();
          let othersMsgLength = msgs.filter(
            (msg) => msg.id !== room.localParticipant.identity,
          ).length;
          setChatMsg((prev) => ({
            unhandled: prev.unhandled + othersMsgLength,
            msgs: [...prev.msgs, ...msgs],
          }));
        } else {
          console.error('Failed to fetch chat messages:', response.statusText);
        }
      };

      if (init) {
        // 获取历史聊天记录
        fetchChatMsg();
        syncSettings().then(() => {
          // 新的用户更新到服务器之后，需要给每个参与者发送一个websocket事件，通知他们更新用户状态
          socket.emit('update_user_status');
        });
        setInit(false);
      }

      // license 检测 -----------------------------------------------------------------------------
      const checkLicense = async () => {
        let url = `https://vocespace.com/api/license/${IP}`;
        const response = await fetch(url, {
          method: 'GET',
        });
        if (response.ok) {
          const { id, email, domains, created_at, expires_at, ilimit, value } =
            await response.json();
          setULicenseState((prev) => ({
            ...prev,
            id,
            email,
            domains,
            created_at,
            expires_at,
            ilimit,
            value,
          }));
        }
      };

      if (uLicenseState.value !== '') {
        if (!(IP === 'localhost' || IP.startsWith('192.168.'))) {
          checkLicense();
        }
      } else {
        let value = window.localStorage.getItem('license');
        if (value && value !== '') {
          setULicenseState((prev) => ({
            ...prev,
            value,
          }));
        }
      }

      // 监听服务器的提醒事件的响应 -------------------------------------------------------------------
      socket.on('wave_response', (msg: WsTo) => {
        if (msg.receiverId === room.localParticipant.identity && msg.room === room.name) {
          waveAudioRef.current?.play();
          noteApi.info({
            message: `${msg.senderName} ${t('common.wave_msg')}`,
          });
        }
      });

      // 监听服务器的用户状态更新事件 -------------------------------------------------------------------
      socket.on('user_status_updated', async () => {
        // 调用fetchSettings
        await fetchSettings();
        console.warn('update ------', settings);
      });

      // 房间事件监听器 --------------------------------------------------------------------------------
      const onParticipantConnected = async (participant: Participant) => {
        // 当前为特殊通行证
        let user_limit = 60;

        if (room.remoteParticipants.size > user_limit) {
          if (room.localParticipant.identity === participant.identity) {
            messageApi.error({
              content: t('common.full_user'),
              duration: 3,
            });
            room.disconnect(true);
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
          room: room.name,
          senderName: participant.name || participant.identity,
          senderId: participant.identity,
          receiverId: '',
          receSocketId: '',
        });
        // do clearSettings but use leave participant
        await clearSettings(participant.identity);
      };
      // 监听远程参与者连接事件 --------------------------------------------------------------------------
      room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
      // room.on(RoomEvent.TrackSub)
      // 监听本地用户开关摄像头事件 ----------------------------------------------------------------------
      const onTrackHandler = (track: TrackPublication) => {
        if (track.source === Track.Source.Camera) {
          // 需要判断虚拟形象是否开启，若开启则需要关闭
          if (
            uState.virtual.enabled ||
            settings.participants[room.localParticipant.identity]?.virtual.enabled
          ) {
            updateSettings({
              virtual: {
                ...uState.virtual,
                enabled: false,
              },
            }).then(() => {
              socket.emit('update_user_status');
            });
          }
        }
      };

      // [用户定义新状态] ----------------------------------------------------------------------
      socket.on('new_user_status_response', (msg: { status: UserDefineStatus[]; room: string }) => {
        if (room.name === msg.room) {
          setURoomStatusState(msg.status);
        }
      });

      room.localParticipant.on(ParticipantEvent.TrackMuted, onTrackHandler);
      room.on(RoomEvent.ParticipantDisconnected, onParticipantDisConnected);

      // [用户邀请事件] -------------------------------------------------------------------------
      socket.on('invite_device_response', (msg: WsInviteDevice) => {
        if (msg.receiverId === room.localParticipant.identity && msg.room === room.name) {
          let device_str;
          let open: () => Promise<LocalTrackPublication | undefined>;
          switch (msg.device) {
            case Track.Source.Camera:
              device_str = '摄像头';
              open = () => room.localParticipant.setCameraEnabled(true);
              break;
            case Track.Source.Microphone:
              device_str = '麦克风';
              open = () => room.localParticipant.setMicrophoneEnabled(true);
              break;
            case Track.Source.ScreenShare:
              device_str = '屏幕共享';
              open = () => room.localParticipant.setScreenShareEnabled(true);
              break;
            default:
              return;
          }

          const btn = (
            <Button
              type="primary"
              size="small"
              onClick={async () => {
                await open();
                noteApi.destroy();
              }}
            >
              {t('common.open')}
            </Button>
          );

          noteApi.info({
            message: `${msg.senderName} ${t('msg.info.invite_device')} ${device_str}`,
            duration: 5,
            btn,
          });
        }
      });
      // [用户被移除出房间] ----------------------------------------------------------------
      socket.on('remove_participant_response', async (msg: WsTo) => {
        if (msg.receiverId === room.localParticipant.identity && msg.room === room.name) {
          await onParticipantDisConnected(room.localParticipant);
          messageApi.error({
            content: t('msg.info.remove_participant'),
            duration: 3,
          });
          room.disconnect(true);
          router.push('/');
          socket.emit('update_user_status');
        }
      });
      // [用户控制事件] -------------------------------------------------------------------
      socket.on('control_participant_response', async (msg: WsControlParticipant) => {
        if (msg.receiverId === room.localParticipant.identity && msg.room === room.name) {
          switch (msg.type) {
            case ControlType.ChangeName: {
              await room.localParticipant?.setMetadata(JSON.stringify({ name: msg.username! }));
              await room.localParticipant.setName(msg.username!);
              await updateSettings({
                name: msg.username!,
              });
              messageApi.success(t('msg.success.user.username.change'));
              socket.emit('update_user_status');
              break;
            }
            case ControlType.MuteAudio: {
              await room.localParticipant.setMicrophoneEnabled(false);
              messageApi.success(t('msg.success.device.mute.audio'));
              break;
            }
            case ControlType.MuteVideo: {
              await room.localParticipant.setCameraEnabled(false);
              messageApi.success(t('msg.success.device.mute.video'));
              break;
            }
            case ControlType.Transfer: {
              const success = await updateOwnerId(room.localParticipant.identity);
              if (success) {
                messageApi.success(t('msg.success.user.transfer'));
              }
              socket.emit('update_user_status');
              break;
            }
            case ControlType.Volume: {
              await updateSettings({
                volume: msg.volume!,
              });
              socket.emit('update_user_status');
              break;
            }
            case ControlType.BlurVideo: {
              await updateSettings({
                blur: msg.blur!,
              });
              socket.emit('update_user_status');
              break;
            }
            case ControlType.BlurScreen: {
              await updateSettings({
                screenBlur: msg.blur!,
              });
              socket.emit('update_user_status');
              break;
            }
          }
        }
      });
      // [参与者请求主持人录屏] ---------------------------------------------------
      socket.on('req_record_response', (msg: WsTo) => {
        if (msg.receiverId === room.localParticipant.identity && msg.room === room.name) {
          noteApi.info({
            message: `${msg.senderName} ${t('msg.info.req_record')}`,
            duration: 5,
          });
        }
      });
      // [主持人进行了录屏，询问参会者是否还要呆在房间] -----------------------------------
      socket.on('recording_response', (msg: { room: string }) => {
        if (msg.room === room.name) {
          noteApi.warning({
            message: t('msg.info.recording'),
            btn: (
              <Button
                color="danger"
                size="small"
                onClick={async () => {
                  await onParticipantDisConnected(room.localParticipant);
                  room.disconnect(true);
                  router.push('/');
                  socket.emit('update_user_status');
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
          room: string;
          reocrd: {
            active: boolean;
            egressId: string;
            filePath: string;
          };
        }) => {
          if (msg.room === room.name) {
            await updateSettings(settings.participants[room.localParticipant.identity], msg.reocrd);
            socket.emit('update_user_status');
          }
        },
      );
      // [用户获取到其他参与者聊天信息事件] ------------------------------------------------
      socket.on('chat_msg_response', (msg: ChatMsgItem) => {
        if (msg.roomName === room.name) {
          setChatMsg((prev) => {
            return {
              unhandled: prev.unhandled + 1,
              msgs: [...prev.msgs, msg],
            };
          });
        }
      });

      socket.on('chat_file_response', (msg: ChatMsgItem) => {
        if (msg.roomName === room.name) {
          setChatMsg((prev) => {
            // 使用函数式更新来获取最新的 messages 状态
            const existingFile = prev.msgs.find((m) => m.id === msg.id);
            if (!existingFile) {
              let isOthers = msg.id !== room.localParticipant.identity;
              return {
                unhandled: prev.unhandled + (isOthers ? 1 : 0),
                msgs: [...prev.msgs, msg],
              };
            }
            return prev; // 如果文件已存在，则不更新状态
          });
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
        room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
        room.off(ParticipantEvent.TrackMuted, onTrackHandler);
        room.off(RoomEvent.ParticipantDisconnected, onParticipantDisConnected);
      };
    }, [room?.state, room?.localParticipant, uState, init, uLicenseState, IP, chatMsg, socket]);

    const selfRoom = useMemo(() => {
      if (!room || room.state !== ConnectionState.Connected) return;

      let selfRoom = settings.children.find((child) => {
        return child.participants.includes(room.localParticipant.identity);
      });

      let allChildParticipants = settings.children.reduce((acc, room) => {
        return acc.concat(room.participants);
      }, [] as string[]);

      if (!selfRoom) {
        // 这里还需要过滤掉进入子房间的参与者
        selfRoom = {
          name: room.name,
          participants: Object.keys(settings.participants).filter((pid) => {
            return !allChildParticipants.includes(pid);
          }),
          ownerId: settings.ownerId,
          isPrivate: false,
        };
      }
      return selfRoom;
    }, [settings.children, room]);

    useLayoutEffect(() => {
      if (!settings || !room || room.state !== ConnectionState.Connected) return;
      if (!freshPermission) return;
      console.warn('freshPermission', freshPermission);
      // 发送一次fetchSettings请求，确保settings是最新的
      fetchSettings();
    }, [settings, room, freshPermission]);

    useEffect(() => {
      if (!room || room.state !== ConnectionState.Connected || !selfRoom) return;

      // 判断当前自己在哪个房间中，在不同的房间中设置不同用户的订阅权限
      // 订阅规则:
      // 1. 当用户在主房间时，可以订阅所有参与者的视频轨道，但不能订阅子房间用户的音频轨道
      // 2. 当用户在子房间时，可以订阅该子房间内的所有参与者的视频和音频轨道，包括主房间的参与者的视频轨道，但不能订阅主房间参与者的音频轨道
      let auth = [] as ParticipantTrackPermission[];
      // 远程参与者不在同一房间内，只订阅视频轨道
      let videoTrackSid = room.localParticipant.getTrackPublication(Track.Source.Camera)?.trackSid;
      let allowedTrackSids = [] ;
      let shareTrackSid = room.localParticipant.getTrackPublication(
        Track.Source.ScreenShare,
      )?.trackSid;
      let audioTrackSid = room.localParticipant.getTrackPublication(
        Track.Source.Microphone,
      )?.trackSid;

      if (videoTrackSid) {
        allowedTrackSids.push(videoTrackSid);
      }
      if (shareTrackSid) {
        allowedTrackSids.push(shareTrackSid);
      }
      // if (audioTrackSid) {
      //   allowedTrackSids.push(audioTrackSid);
      // }
      // 遍历所有的远程参与者，根据规则进行处理
      // if (settings.ownerId === room.localParticipant.identity) {
      //   // 主持人需要订阅所有参与者的音频
      //   let allowedTrackSids = [];
      //   if (audioTrackSid) {
      //     allowedTrackSids.push(audioTrackSid);
      //   }
      //   room.remoteParticipants.forEach((rp) => {
      //     // 由于我们已经可以从selfRoom中获取当前用户所在的房间信息，所以通过selfRoom进行判断
      //     if (selfRoom.participants.includes(rp.identity)) {
      //       auth.push({
      //         participantIdentity: rp.identity,
      //         allowAll: false,
      //         allowedTrackSids,
      //       });
      //       let volume = settings.participants[rp.identity]?.volume / 100.0;
      //       if (isNaN(volume)) {
      //         volume = 1.0;
      //       }
      //       rp.setVolume(volume);
      //     } else {
      //       auth.push({
      //         participantIdentity: rp.identity,
      //         allowAll: false,
      //         allowedTrackSids,
      //       });
      //     }
      //   });
      // } else {
      //   // 对于非主持人参与者只需要订阅主持人的音频和屏幕分享
      //   let owner = room.remoteParticipants.get(settings.ownerId);
      //   console.warn("owner ------", owner);
      //   if (owner) {
      //     let allowedTrackSids = [];

      //     if (audioTrackSid) {
      //       allowedTrackSids.push(audioTrackSid);
      //     }
      //     if (shareTrackSid) {
      //       allowedTrackSids.push(shareTrackSid);
      //     }

      //     auth.push({
      //       participantIdentity: owner.identity,
      //       allowAll: true
      //     });
      //   }
      // }
      room.remoteParticipants.forEach((rp) => {
        
          // 由于我们已经可以从selfRoom中获取当前用户所在的房间信息，所以通过selfRoom进行判断
          if (selfRoom.participants.includes(rp.identity)) {
            auth.push({
              participantIdentity: rp.identity,
              allowAll: false,
              allowedTrackSids,
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
      // room.localParticipant.setTrackSubscriptionPermissions(false, auth);
      if (freshPermission) {
        fetchSettings().then(() => {
          setFreshPermission(false);
        });
        socket.emit('update_user_status');
      }
    }, [room, settings, selfRoom, freshPermission]);

    useEffect(() => {
      if (!room || room.state !== ConnectionState.Connected || !settings) return;
      // 同步settings中当前参与者的数据到uState中 -----------------------------------------------------
      if (settings.participants[room.localParticipant.identity]) {
        setUState((prev) => {
          let newState = {
            ...prev,
            ...settings.participants[room.localParticipant.identity],
          };
          // 同步后还需要设置到localStorage中
          localStorage.setItem(PARTICIPANT_SETTINGS_KEY, JSON.stringify(newState));
          return newState;
        });
      }
      // 同步settings中的房间的状态到uRoomStatusState中 ----------------------------------------
      if (settings.status && settings.status.length > 0) {
        setURoomStatusState((prev) => {
          const newState = [...prev];
          if (prev !== settings!.status!) {
            return settings!.status!;
          }
          return newState;
        });
      }
    }, [room, settings, uRoomStatusState]);

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

    const focusTrack =
      usePinnedTracks(layoutContext)?.[0] ??
      tracks.find((track) => track.source === Track.Source.ScreenShare);
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

    const toSettingGeneral = () => {
      controlsRef.current?.openSettings('general');
    };
    // [user status] ------------------------------------------------------------------------------------------
    const setUserStatus = async (status: UserStatus | string) => {
      let newStatus = {
        status,
      };
      switch (status) {
        case UserStatus.Online: {
          if (room) {
            room.localParticipant.setMicrophoneEnabled(true);
            room.localParticipant.setCameraEnabled(true);
            room.localParticipant.setScreenShareEnabled(false);
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
          if (room) {
            room.localParticipant.setMicrophoneEnabled(false);
            room.localParticipant.setCameraEnabled(false);
            room.localParticipant.setScreenShareEnabled(false);
          }
          break;
        }
        default: {
          if (room) {
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
      socket.emit('update_user_status');
    };

    useImperativeHandle(ref, () => ({
      removeLocalSettings: () => clearSettings(),
    }));
    const [focusOpen, setFocusOpen] = useState(true);

    return (
      <div className="video_container_wrapper" style={{ position: 'relative' }}>
        {/* <FocusCollapse open={focusOpen} setOpen={setFocusOpen}></FocusCollapse> */}
        {/* <FlotLayout
          style={{ position: 'absolute', top: '50px', right: '0px', zIndex: 1111 }}
          messageApi={messageApi}
          openApp={openApp}
        ></FlotLayout> */}
        {/* {room && (
          <Channel
            roomName={room.name}
            participantId={room.localParticipant.identity}
            settings={settings}
            onUpdate={async () => {
              await fetchSettings();
              socket.emit('update_user_status');
            }}
            tracks={originTracks}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            messageApi={messageApi}
            isActive={isActive}
          ></Channel>
        )} */}
        <div
          className="lk-video-conference"
          {...props}
          style={{
            height: '100vh',
            transition: 'width 0.3s ease-in-out',
            width: collapsed ? (isActive ? 'calc(100vw - 0px)' : '100vw') : 'calc(100vw - 0px)',
          }}
        >
          {is_web() && (
            <LayoutContextProvider
              value={layoutContext}
              // onPinChange={handleFocusStateChange}
              onWidgetChange={widgetUpdate}
            >
              <div className="lk-video-conference-inner" style={{ alignItems: 'space-between' }}>
                {/* {!focusTrack ? (
                  <div className="lk-grid-layout-wrapper">
                    <GridLayout tracks={tracks}>
                      <ParticipantItem
                        room={room?.name}
                        settings={settings}
                        toSettings={toSettingGeneral}
                        messageApi={messageApi}
                        setUserStatus={setUserStatus}
                      ></ParticipantItem>
                    </GridLayout>
                  </div>
                ) : (
                  <div className="lk-focus-layout-wrapper">
                    <FocusLayoutContainer>
                      <CarouselLayout tracks={carouselTracks}>
                        <ParticipantItem
                          room={room?.name}
                          settings={settings}
                          toSettings={toSettingGeneral}
                          messageApi={messageApi}
                          setUserStatus={setUserStatus}
                        ></ParticipantItem>
                      </CarouselLayout>
                      {focusTrack && (
                        <ParticipantItem
                          room={room?.name}
                          setUserStatus={setUserStatus}
                          settings={settings}
                          toSettings={toSettingGeneral}
                          trackRef={focusTrack}
                          messageApi={messageApi}
                          isFocus={isFocus}
                        ></ParticipantItem>
                      )}
                    </FocusLayoutContainer>
                  </div>
                )} */}

                {!focusTrack ? (
                  <div className="lk-grid-layout-wrapper">
                    <ParticipantPlaceholder height={'66%'} width={'66%'} />
                  </div>
                ) : (
                  <div className="lk-focus-layout-wrapper">
                    <ParticipantItem
                      room={room?.name}
                      setUserStatus={setUserStatus}
                      settings={settings}
                      toSettings={toSettingGeneral}
                      trackRef={focusTrack}
                      messageApi={messageApi}
                      isFocus={isFocus}
                    ></ParticipantItem>
                  </div>
                )}

                <Controls
                  ref={controlsRef}
                  setUserStatus={setUserStatus}
                  controls={{ chat: true, settings: !!SettingsComponent }}
                  updateSettings={updateSettings}
                  roomSettings={settings}
                  fetchSettings={fetchSettings}
                  updateRecord={updateRecord}
                  setPermissionDevice={setPermissionDevice}
                  collapsed={collapsed}
                  setCollapsed={setCollapsed}
                  openApp={openApp}
                  setOpenApp={setOpenApp}
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
