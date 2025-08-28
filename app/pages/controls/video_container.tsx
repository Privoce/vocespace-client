import {
  connect_endpoint,
  getServerIp,
  is_web,
  Role,
  src,
  UserDefineStatus,
  UserStatus,
} from '@/lib/std';
import {
  ConnectionStateToast,
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
import { licenseState, roomStatusState, socket, userState } from '@/app/[roomName]/PageClientImpl';
import { useRouter } from 'next/navigation';
import { ControlType, WsBase, WsControlParticipant, WsInviteDevice, WsTo } from '@/lib/std/device';
import { Button } from 'antd';
import { PARTICIPANT_SETTINGS_KEY } from '@/lib/std/room';
import { SvgResource } from '@/app/resources/svg';

export interface VideoContainerProps extends VideoConferenceProps {
  messageApi: MessageInstance;
  noteApi: NotificationInstance;
  setPermissionDevice: (device: Track.Source) => void;
  role: Role;
}

export interface VideoContainerExports {
  removeLocalSettings: () => Promise<void>;
}

const IP = 'sge_event.com';
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
      role,
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
    // const [chatMsg, setChatMsg] = useRecoilState(chatMsgState);
    const [uRoomStatusState, setURoomStatusState] = useRecoilState(roomStatusState);
    const [fullScreen, setFullScreen] = useState(true);
    const router = useRouter();
    const { settings, updateSettings, fetchSettings, clearSettings, updateOwnerId, updateRecord } =
      useRoomSettings(
        room?.name || '', // 房间 ID
        room?.localParticipant?.identity || '', // 参与者 ID
      );
    const [openApp, setOpenApp] = useState<boolean>(false);
    const isActive = true;

    // 当鼠标移动到window的底部80px时，设置fullScreen为false，显示控制栏
    // useEffect(() => {
    //   const handleMouseMove = (event: MouseEvent) => {
    //     if (event.clientY > window.innerHeight - 80) {
    //       setFullScreen(false);
    //     }else{
    //       setFullScreen(true);
    //     }
    //   };
    //   window.addEventListener('mousemove', handleMouseMove);
    //   return () => {
    //     window.removeEventListener('mousemove', handleMouseMove);
    //   };
    // }, []);

    useEffect(() => {
      if (room) {
        if (uLicenseState.expires_at < Date.now() / 1000) {
          messageApi.error(t('common.license_invalid'), 6000);
          setTimeout(() => {
            room?.disconnect();
          }, 8000);
        }
      }
    }, [room]);

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
          role,
        });
      };

      if (init) {
        // 获取历史聊天记录
        // fetchChatMsg();
        syncSettings().then(() => {
          // 新的用户更新到服务器之后，需要给每个参与者发送一个websocket事件，通知他们更新用户状态
          socket.emit('update_user_status');
        });
        setInit(false);
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
        // console.warn('update ------', settings);
      });

      // 房间事件监听器 --------------------------------------------------------------------------------
      const onParticipantConnected = async (participant: Participant) => {
        // 当前为特殊通行证
        let user_limit = 99;

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
      socket.on('reload_response', (msg: WsBase) => {
        if (msg.room === room.name) {
          // 在localstorage中添加一个reload标记，这样退出之后如果有这个标记就可以自动重载
          if (uState.role === 'student') {
            console.warn(uState.role);
            localStorage.setItem('reload', 'true');
          }
          room.disconnect(true);
        }
      });

      socket.on('focus_clear_response', (msg: WsBase) => {
        if (msg.room === room.name) {
          room.disconnect(true);
        }
      });

      return () => {
        socket.off('reload_response');
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
        room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
        room.off(ParticipantEvent.TrackMuted, onTrackHandler);
        room.off(RoomEvent.ParticipantDisconnected, onParticipantDisConnected);
      };
    }, [room?.state, room?.localParticipant, uState, init, uLicenseState, IP, socket, role]);

    useLayoutEffect(() => {
      if (!settings || !room || room.state !== ConnectionState.Connected) return;
      if (!freshPermission) return;
      // console.warn('freshPermission', freshPermission);
      // 发送一次fetchSettings请求，确保settings是最新的
      fetchSettings();
    }, [settings, room, freshPermission]);

    useEffect(() => {
      if (!room || room.state !== ConnectionState.Connected) return;

      // 对于主持人，不订阅任何轨道
      // 对于参与者，只能订阅主持人的视频共享轨道

      let auth = [] as ParticipantTrackPermission[];
      let allowedTrackSids = [];
      let videoTrackSid = room.localParticipant.getTrackPublication(Track.Source.Camera)?.trackSid;
      let shareTrackSid = room.localParticipant.getTrackPublication(
        Track.Source.ScreenShare,
      )?.trackSid;

      if (videoTrackSid) {
        allowedTrackSids.push(videoTrackSid);
      }
      if (shareTrackSid) {
        allowedTrackSids.push(shareTrackSid);
      }

      if (settings.ownerIds.includes(room.localParticipant.identity)) {
        // 主持人需要保证每个参与者都可以订阅自己的视频轨道
        room.remoteParticipants.forEach((rp) => {
          auth.push({
            participantIdentity: rp.identity,
            allowAll: true,
          });
          let volume = settings.participants[rp.identity]?.volume / 100.0;
          if (isNaN(volume)) {
            volume = 1.0;
          }
          rp.setVolume(volume);
        });
      } else {
        settings.ownerIds.forEach((ownerId) => {
          let hasOwner = room.remoteParticipants.has(ownerId);
          if (hasOwner) {
            auth.push({
              participantIdentity: ownerId,
              allowAll: false,
              allowedTrackSids,
            });
          }
        });
      }

      // 设置房间订阅权限 ------------------------------------------------
      room.localParticipant.setTrackSubscriptionPermissions(false, auth);
      if (freshPermission) {
        fetchSettings().then(() => {
          setFreshPermission(false);
        });
        socket.emit('update_user_status');
      }
    }, [room, settings, freshPermission]);

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
    const tracks = useTracks(
      [
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
      ],
      { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
    );

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
                {!focusTrack ? (
                  <div
                    className="lk-grid-layout-wrapper"
                    style={{ height: fullScreen ? '100%' : 'calc(100% - 69px)' }}
                  >
                    <div
                      style={{
                        backgroundColor: '#1e1e1e',
                        width: 'calc(100% - 16px)',
                        height: 'calc(100% - 8px)',
                        margin: '8px 8px 0 8px',
                        boxSizing: 'border-box',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 8,
                      }}
                    >
                      <ParticipantPlaceholder height={'66%'} width={'66%'} />
                    </div>
                  </div>
                ) : (
                  <div
                    className="lk-focus-layout-wrapper"
                    style={{ height: fullScreen ? '100%' : 'calc(100% - 69px)' }}
                  >
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
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    bottom: 4,
                    width: '32px',
                    height: '61px',
                    alignItems: 'center',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <button
                    className="vocespace_button_text"
                    style={{ width: '100%', height: '100%' }}
                    onClick={() => {
                      setFullScreen(!fullScreen);
                    }}
                  >
                    <SvgResource type="right" svgSize={16}></SvgResource>
                  </button>
                </div>
                {!fullScreen && (
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
                    room={room}
                    track={focusTrack}
                  ></Controls>
                )}
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
