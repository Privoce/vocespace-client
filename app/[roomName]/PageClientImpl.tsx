'use client';

import { VideoContainer, VideoContainerExports } from '@/app/pages/controls/video_container';
import { decodePassphrase } from '@/lib/client_utils';
// import { DebugMode } from '@/lib/Debug';
import { useI18n } from '@/lib/i18n/i18n';
import { RecordingIndicator } from './RecordingIndicator';
import { ConnectionDetails } from '@/lib/types';
import { formatChatMessageLinks, LiveKitRoom, LocalUserChoices } from '@livekit/components-react';
import { Button, message, Modal, notification, Space } from 'antd';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  MediaDeviceFailure,
  Track,
  VideoPreset,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { atom, useRecoilState } from 'recoil';
import { connect_endpoint, isUndefinedString, Role, UserDefineStatus } from '@/lib/std';
import io from 'socket.io-client';
import { EnvConf } from '@/lib/std/env';
import { ChatMsgItem } from '@/lib/std/chat';
import {
  DEFAULT_PARTICIPANT_SETTINGS,
  PARTICIPANT_SETTINGS_KEY,
  ParticipantSettings,
} from '@/lib/std/room';
import { TodoItem } from '../pages/apps/todo_list';
import dayjs, { type Dayjs } from 'dayjs';
import { JoinRoom } from './join';
import { TurnConf, VocespaceConfig } from '@/lib/std/conf';
import api from '@/lib/api';

export const socket = io();

export const userState = atom({
  key: 'userState',
  default: {
    ...DEFAULT_PARTICIPANT_SETTINGS,
  } as ParticipantSettings,
});

export const roomStatusState = atom({
  key: 'roomStatusState',
  default: [] as UserDefineStatus[],
});

export const licenseState = atom({
  key: 'licenseState',
  default: {
    id: undefined,
    email: undefined,
    domains: '*',
    created_at: 1747742400,
    expires_at: 1779278400,
    value: 'vocespace_pro__KUgwpDrr-g3iXIX41rTrSCsWAcn9UFX8dOYMr0gAARQ',
    ilimit: 'Free',
  },
});

export const roomIdTmpState = atom({
  key: 'roomIdTmpState',
  default: '',
});

export const virtualMaskState = atom({
  key: 'virtualMaskState',
  default: false,
});

export const chatMsgState = atom({
  key: 'chatMsgState',
  default: {
    msgs: [] as ChatMsgItem[],
    unhandled: 0,
  },
});

export const AppsDataState = atom({
  key: 'AppsDataState',
  default: {
    todo: [] as TodoItem[],
    timer: {
      value: null as number | null,
      running: false,
      stopTimeStamp: null as number | null,
      records: [] as string[],
    },
    countdown: {
      value: null as number | null,
      duration: dayjs().hour(0).minute(5).second(0) as Dayjs | null,
      running: false,
      stopTimeStamp: null as number | null,
    },
  },
});

const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
  student: boolean;
  login: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [student, setStudent] = useState(props.student);
  const [login, setLogin] = useState(props.login);
  const [uState, setUState] = useRecoilState(userState);
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const [role, setRole] = useState<Role>('teacher');
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const connectionDetailsData = await api.joinRoom(props.roomName, values.username, props.region);
    setConnectionDetails(connectionDetailsData);
  }, []);
  // 从localStorage中获取用户设置 --------------------------------------------------------------------
  const directLogin = async () => {
    const response = await api.getUniqueUsername('voce_stream', 'student');
    if (response.ok) {
      const { name } = await response.json();
      const finalUserChoices = {
        username: name,
        videoEnabled: false,
        audioEnabled: false,
        videoDeviceId: '',
        audioDeviceId: '',
      } as LocalUserChoices;
      await handlePreJoinSubmit(finalUserChoices);
    } else {
      messageApi.error(`${t('msg.error.user.username.request')}: ${response.statusText}`);
      setStudent(false);
      setLogin(false);
    }
    // 路由到基本地址
    router.replace('/voce_stream');
  };

  useEffect(() => {
    const storedSettingsStr = localStorage.getItem(PARTICIPANT_SETTINGS_KEY);
    if (storedSettingsStr) {
      const storedSettings: ParticipantSettings = JSON.parse(storedSettingsStr);
      setUState(storedSettings);
    } else {
      // 没有则存到localStorage中
      localStorage.setItem(PARTICIPANT_SETTINGS_KEY, JSON.stringify(uState));
    }

    if (student && login) {
      // 学生登陆只要提供了这两个参数，就直接进入房间
      directLogin();
    }

    return () => {
      // 在组件卸载时将用户设置存储到localStorage中，保证用户设置的持久化
      localStorage.setItem(PARTICIPANT_SETTINGS_KEY, JSON.stringify(uState));
    };
  }, [student, login]);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {contextHolder}
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <JoinRoom
          onSubmit={handlePreJoinSubmit}
          role={role}
          setRole={setRole}
          messageApi={messageApi}
        ></JoinRoom>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
          role={role}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
  role: Role;
}) {
  const { t } = useI18n();
  const e2eePassphrase =
    typeof window !== 'undefined' && decodePassphrase(location.hash.substring(1));

  const worker =
    typeof window !== 'undefined' &&
    e2eePassphrase &&
    new Worker(new URL('livekit-client/e2ee-worker', import.meta.url));
  const e2eeEnabled = !!(e2eePassphrase && worker);
  const keyProvider = new ExternalE2EEKeyProvider();
  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [notApi, notHolder] = notification.useNotification();
  const [permissionOpened, setPermissionOpened] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionDevice, setPermissionDevice] = useState<Track.Source | null>(null);
  const videoContainerRef = React.useRef<VideoContainerExports>(null);
  const [screenShareOption, setScreenShareOption] = React.useState<EnvConf | null>(null);
  const [turn, setTurn] = useState<TurnConf | undefined>(undefined);
  const fetchEnvConf = useCallback(async () => {
    const {
      resolution,
      maxBitrate,
      maxFramerate,
      priority,
      livekit: { turn: turnConf },
    }: VocespaceConfig = await api.envConf();
    if (turnConf) {
      setTurn(turnConf);
    }
    return {
      resolution,
      maxBitrate,
      maxFramerate,
      priority,
    } as EnvConf;
  }, []);

  useEffect(() => {
    if (!screenShareOption) {
      fetchEnvConf().then(setScreenShareOption);
    }
  }, [screenShareOption, fetchEnvConf]);

  const resolutions = useMemo(() => {
    const resolution = screenShareOption?.resolution || '1080p';
    switch (resolution) {
      case '4k':
        return {
          h: new VideoPreset(
            3840,
            2160,
            screenShareOption?.maxBitrate || 8_000_000,
            screenShareOption?.maxFramerate || 30,
            screenShareOption?.priority || 'medium',
          ),
          l: new VideoPreset(
            2560,
            1440,
            screenShareOption?.maxBitrate || 5_000_000,
            screenShareOption?.maxFramerate || 30,
            screenShareOption?.priority || 'medium',
          ),
        };
      case '2k':
        return {
          h: new VideoPreset(
            2560,
            1440,
            screenShareOption?.maxBitrate || 5_000_000,
            screenShareOption?.maxFramerate || 30,
            screenShareOption?.priority || 'medium',
          ),
          l: new VideoPreset(
            1920,
            1080,
            screenShareOption?.maxBitrate || 3_000_000,
            screenShareOption?.maxFramerate || 30,
            screenShareOption?.priority || 'medium',
          ),
        };
      case '1080p':
        return {
          h: new VideoPreset(
            1920,
            1080,
            screenShareOption?.maxBitrate || 3_000_000,
            screenShareOption?.maxFramerate || 30,
            screenShareOption?.priority || 'medium',
          ),
          l: new VideoPreset(
            1280,
            720,
            screenShareOption?.maxBitrate || 1_700_000,
            screenShareOption?.maxFramerate || 30,
            screenShareOption?.priority || 'medium',
          ),
        };
      case '720p':
        return {
          h: new VideoPreset(
            1280,
            720,
            screenShareOption?.maxBitrate || 1_700_000,
            screenShareOption?.maxFramerate || 30,
            screenShareOption?.priority || 'medium',
          ),
          l: new VideoPreset(
            960,
            540,
            screenShareOption?.maxBitrate || 800_000,
            screenShareOption?.maxFramerate || 25,
            screenShareOption?.priority || 'medium',
          ),
        };
      case '540p':
        return {
          h: new VideoPreset(
            960,
            540,
            screenShareOption?.maxBitrate || 800_000,
            screenShareOption?.maxFramerate || 25,
            screenShareOption?.priority || 'medium',
          ),
          l: new VideoPreset(
            640,
            360,
            screenShareOption?.maxBitrate || 450_000,
            screenShareOption?.maxFramerate || 25,
            screenShareOption?.priority || 'medium',
          ),
        };
      default:
        return {
          h: new VideoPreset(
            1920,
            1080,
            screenShareOption?.maxBitrate || 3_000_000,
            screenShareOption?.maxFramerate || 30,
            screenShareOption?.priority || 'medium',
          ),
          l: new VideoPreset(
            1280,
            720,
            screenShareOption?.maxBitrate || 1_700_000,
            screenShareOption?.maxFramerate || 30,
            screenShareOption?.priority || 'medium',
          ),
        };
    }
  }, [screenShareOption]);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const screenShareEncoding = {
      maxBitrate: screenShareOption?.maxBitrate || 12000,
      maxFramerate: screenShareOption?.maxFramerate || 30,
      priority: screenShareOption?.priority || 'medium',
    };

    return {
      videoCaptureDefaults: {
        deviceId: props.userChoices.videoDeviceId ?? undefined,
        resolution: props.options.hq ? resolutions.h : resolutions.h,
      },
      publishDefaults: {
        dtx: false,
        videoSimulcastLayers: props.options.hq ? [resolutions.h, resolutions.l] : [resolutions.h],
        red: !e2eeEnabled,
        videoCodec,
        screenShareEncoding,
        screenShareSimulcastLayers: [resolutions.h, resolutions.l],
      },
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      e2ee: e2eeEnabled
        ? {
            keyProvider,
            worker,
          }
        : undefined,
    };
  }, [props.userChoices, props.options.hq, props.options.codec, screenShareOption, resolutions]);

  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);
  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              console.error(t('msg.error.e2ee.unsupport'));
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    let conf = {
      maxRetries: 5,
      autoSubscribe: true,
    } as RoomConnectOptions;

    if (turn && !isUndefinedString(turn.credential) && !isUndefinedString(turn.username)) {
      conf.rtcConfig = {
        iceServers: [
          {
            urls: turn.urls,
            username: turn.username,
            credential: turn.credential,
          },
        ],
        iceCandidatePoolSize: 20,
        iceTransportPolicy: 'all',
      };
    }

    return conf;
  }, [turn]);

  const router = useRouter();
  const handleOnLeave = React.useCallback(async () => {
    socket.emit('mouse_remove', {
      room: room.name,
      senderName: room.localParticipant.name || room.localParticipant.identity,
      senderId: room.localParticipant.identity,
      receiverId: '',
      receSocketId: '',
    });
    router.push('/');
    socket.emit('update_user_status');
    await videoContainerRef.current?.removeLocalSettings();
    socket.disconnect();
    // 刷新页面
    window.location.reload();
  }, [router, room.localParticipant]);
  const handleError = React.useCallback((error: Error) => {
    console.error(`${t('msg.error.room.unexpect')}: ${error.message}`);
    if (error.name === 'ConnectionError') {
      messageApi.error(t('msg.error.room.network'));
    } else {
      console.error(error);
    }
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    messageApi.error(`${t('msg.error.room.unexpect')}: ${error.message}`);
  }, []);

  const handleMediaDeviceFailure = React.useCallback((fail?: MediaDeviceFailure) => {
    if (fail) {
      switch (fail) {
        case MediaDeviceFailure.DeviceInUse:
          messageApi.error(t('msg.error.device.in_use'));
          break;
        case MediaDeviceFailure.NotFound:
          messageApi.error(t('msg.error.device.not_found'));
          break;
        case MediaDeviceFailure.PermissionDenied:
          if (!permissionOpened) {
            setPermissionOpened(true);
            notApi.open({
              duration: 3,
              message: t('msg.error.device.permission_denied_title'),
              description: t('msg.error.device.permission_denied_desc'),
              btn: (
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => setPermissionModalVisible(true)}
                  >
                    {t('msg.request.device.allow')}
                  </Button>
                </Space>
              ),
              onClose: () => setPermissionOpened(false),
            });
          }
          break;
        case MediaDeviceFailure.Other:
          messageApi.error(t('msg.error.device.other'));
          break;
      }
    }
  }, []);

  // 请求权限的函数 - 将在用户点击按钮时直接触发
  const requestMediaPermissions = async () => {
    // 重置状态
    setPermissionError(null);
    setPermissionRequested(true);

    try {
      // 请求媒体权限
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // 权限已获取，通知用户
      messageApi.success(t('msg.success.device.granted'));

      // 关闭模态框
      setPermissionModalVisible(false);

      // 尝试重新启用设备
      if (room) {
        try {
          switch (permissionDevice) {
            case Track.Source.Camera:
              await room.localParticipant.setCameraEnabled(true);
              break;
            case Track.Source.Microphone:
              await room.localParticipant.setMicrophoneEnabled(true);
              break;
            case Track.Source.ScreenShare:
              await room.localParticipant.setScreenShareEnabled(true);
              break;
            default:
              // 如果没有指定设备，则启用摄像头和麦克风
              await room.localParticipant.setCameraEnabled(true);
              await room.localParticipant.setMicrophoneEnabled(true);
              break;
          }
        } catch (err) {
          console.error(t('msg.error.device.granted'), err);
        }
      }
    } catch (error: any) {
      console.error(t('msg.error.other.permission'), error);

      // 设置详细错误信息
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionError(t('msg.error.device.granted'));
      } else {
        setPermissionError(`${t('msg.error.other.permission')} ${error.message}`);
      }
    } finally {
      setPermissionRequested(false);
    }
  };
  return (
    <>
      {contextHolder}
      {notHolder}
      {/* 等待配置加载完成 */}
      {!screenShareOption ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
          }}
        >
          <div>Loading configuration...</div>
        </div>
      ) : (
        <LiveKitRoom
          connect={e2eeSetupComplete}
          room={room}
          token={props.connectionDetails.participantToken}
          serverUrl={props.connectionDetails.serverUrl}
          connectOptions={connectOptions}
          video={props.userChoices.videoEnabled}
          audio={props.userChoices.audioEnabled}
          onDisconnected={handleOnLeave}
          onEncryptionError={handleEncryptionError}
          onError={handleError}
          onMediaDeviceFailure={handleMediaDeviceFailure}
        >
          <VideoContainer
            ref={videoContainerRef}
            chatMessageFormatter={formatChatMessageLinks}
            SettingsComponent={undefined}
            messageApi={messageApi}
            noteApi={notApi}
            setPermissionDevice={setPermissionDevice}
            role={props.role}
          ></VideoContainer>
          {/* <DebugMode /> */}
          <RecordingIndicator />
          <Modal
            title={t('msg.request.device.title')}
            open={permissionModalVisible}
            onCancel={() => setPermissionModalVisible(false)}
            footer={[
              <Button key="cancel" onClick={() => setPermissionModalVisible(false)}>
                {t('common.cancel')}
              </Button>,
              <Button
                key="request"
                type="primary"
                loading={permissionRequested}
                onClick={requestMediaPermissions}
                disabled={
                  !!permissionError &&
                  (permissionError.includes('权限被拒绝') ||
                    permissionError.includes('Permission denied'))
                }
              >
                {permissionRequested
                  ? t('msg.request.device.waiting')
                  : t('msg.request.device.allow')}
              </Button>,
            ]}
          />
        </LiveKitRoom>
      )}
      <Modal
        title={t('msg.request.device.title')}
        open={permissionModalVisible}
        onCancel={() => setPermissionModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setPermissionModalVisible(false)}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="request"
            type="primary"
            loading={permissionRequested}
            onClick={requestMediaPermissions}
            disabled={
              !!permissionError &&
              (permissionError.includes('权限被拒绝') ||
                permissionError.includes('Permission denied'))
            }
          >
            {permissionRequested ? t('msg.request.device.waiting') : t('msg.request.device.allow')}
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '16px' }}>Voce Space {t('msg.request.device.ask')}</div>

        {permissionError && (
          <div
            style={{
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '16px',
              color: '#f44336',
            }}
          >
            <p>
              <strong>{t('common.error')}:</strong> {permissionError}
            </p>

            {permissionError.includes('权限被拒绝') ||
            permissionError.includes('Permission denied') ? (
              <div>
                <p>
                  <strong>{t('msg.request.device.permission.how')}</strong>
                </p>
                {renderBrowserSpecificInstructions()}
                <p>{t('msg.request.device.permission.changed_with_reload')}</p>
              </div>
            ) : null}
          </div>
        )}

        <p>
          <strong>{t('common.attention')}:</strong> {t('msg.request.device.permission.set_on_hand')}
        </p>
      </Modal>
    </>
  );
}

const renderBrowserSpecificInstructions = () => {
  const { t } = useI18n();
  // 检测浏览器类型
  const isChrome = navigator.userAgent.indexOf('Chrome') > -1;
  const isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
  const isSafari =
    navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') === -1;
  const isEdge = navigator.userAgent.indexOf('Edg') > -1;

  if (isChrome || isEdge) {
    return (
      <ol>
        <li>{t('msg.request.device.permission.chrome_edge.0')}</li>
        <li>{t('msg.request.device.permission.chrome_edge.1')}</li>
        <li>{t('msg.request.device.permission.chrome_edge.2')}</li>
        <li>{t('msg.request.device.permission.chrome_edge.3')}</li>
      </ol>
    );
  } else if (isFirefox) {
    return (
      <ol>
        <li>{t('msg.request.device.permission.firefox.0')}</li>
        <li>{t('msg.request.device.permission.firefox.1')}</li>
        <li>{t('msg.request.device.permission.firefox.2')}</li>
        <li>{t('msg.request.device.permission.firefox.3')}</li>
        <li>{t('msg.request.device.permission.firefox.4')}</li>
      </ol>
    );
  } else if (isSafari) {
    return (
      <ol>
        <li>{t('msg.request.device.permission.safari.0')}</li>
        <li>{t('msg.request.device.permission.safari.1')}</li>
        <li>{t('msg.request.device.permission.safari.2')}</li>
        <li>{t('msg.request.device.permission.safari.3')}</li>
      </ol>
    );
  } else {
    return (
      <ol>
        <li>{t('msg.request.device.permission.other')}</li>
      </ol>
    );
  }
};
