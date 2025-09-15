'use client';

import { VideoContainer, VideoContainerExports } from '@/app/pages/controls/video_container';
import { decodePassphrase } from '@/lib/client_utils';
// import { DebugMode } from '@/lib/Debug';
import { useI18n } from '@/lib/i18n/i18n';
import { RecordingIndicator } from './RecordingIndicator';
import { ConnectionDetails } from '@/lib/types';
import {
  formatChatMessageLinks,
  LiveKitRoom,
  LocalUserChoices,
  usePersistentUserChoices,
} from '@livekit/components-react';
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
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { PreJoin } from '@/app/pages/pre_join/pre_join';
import { atom, useRecoilState } from 'recoil';
import { UserDefineStatus } from '@/lib/std';
import io from 'socket.io-client';
import { ChatMsgItem } from '@/lib/std/chat';
import {
  AppAuth,
  Countdown,
  DEFAULT_COUNTDOWN,
  DEFAULT_PARTICIPANT_SETTINGS,
  DEFAULT_TIMER,
  PARTICIPANT_SETTINGS_KEY,
  ParticipantSettings,
  Timer,
  TodoItem,
} from '@/lib/std/space';
import { api } from '@/lib/api';
import { WsBase, WsMouseMove, WsTo } from '@/lib/std/device';
import { createRTCQulity, DEFAULT_VOCESPACE_CONFIG, VocespaceConfig } from '@/lib/std/conf';
import { MessageInstance } from 'antd/es/message/interface';
import { NotificationInstance } from 'antd/es/notification/interface';

const TURN_CREDENTIAL = process.env.TURN_CREDENTIAL ?? '';
const TURN_USERNAME = process.env.TURN_USERNAME ?? '';
const TURN_URL = process.env.TURN_URL ?? '';

export const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  timeout: 30000,
  forceNew: true,
  transports: ['websocket', 'polling'],
});

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

// export const AppsDataState = atom({
//   key: 'AppsDataState',
//   default: {
//     todo: [] as TodoItem[],
//     timer: DEFAULT_TIMER,
//     countdown: DEFAULT_COUNTDOWN,
//   },
// });

export const SingleAppDataState = atom({
  key: 'SingleAppDataState',
  default: {
    participantId: undefined as string | undefined,
    participantName: undefined as string | undefined,
    auth: 'read' as AppAuth,
    targetApp: undefined as Timer | Countdown | TodoItem[] | undefined,
  },
});

export function PageClientImpl(props: {
  spaceName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const { t } = useI18n();
  const [uState, setUState] = useRecoilState(userState);
  const [messageApi, contextHolder] = message.useMessage();
  const [notApi, notHolder] = notification.useNotification();
  const [isReload, setIsReload] = useState(false);
  const router = useRouter();
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const { userChoices } = usePersistentUserChoices({
    defaults: {
      videoEnabled: false,
      audioEnabled: false,
    },
    preventSave: false,
    preventLoad: false,
  });
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const connectionDetailsResp = await api.joinSpace(
      props.spaceName,
      values.username,
      props.region,
    );
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
  }, []);
  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  // 从localStorage中获取用户设置 --------------------------------------------------------------------
  useEffect(() => {
    const storedSettingsStr = localStorage.getItem(PARTICIPANT_SETTINGS_KEY);
    if (storedSettingsStr) {
      const storedSettings: ParticipantSettings = JSON.parse(storedSettingsStr);
      if (storedSettings?.version !== '0.3.0') {
        // 版本不匹配/不存在，直接删除
        localStorage.removeItem(PARTICIPANT_SETTINGS_KEY);
        return;
      } else {
        setUState(storedSettings);
      }
    } else {
      // 没有则存到localStorage中
      localStorage.setItem(PARTICIPANT_SETTINGS_KEY, JSON.stringify(uState));
    }

    return () => {
      // 在组件卸载时将用户设置存储到localStorage中，保证用户设置的持久化
      localStorage.setItem(PARTICIPANT_SETTINGS_KEY, JSON.stringify(uState));
    };
  }, []);

  // 配置数据 ----------------------------------------------------------------------------------------
  const [config, setConfig] = useState(DEFAULT_VOCESPACE_CONFIG);
  const [loadConfig, setLoadConfig] = useState(false);

  const getConfig = async () => {
    const response = await api.getConf();
    if (response.ok) {
      const configData: VocespaceConfig = await response.json();
      setConfig(configData);
      setLoadConfig(true);
    } else {
      console.error(t('msg.error.conf_load'));
    }
  };

  useEffect(() => {
    if (!loadConfig) {
      getConfig();
    }
  }, [loadConfig]);

  // 当localStorage中有reload这个标志时，需要重登陆
  useEffect(() => {
    const reloadRoom = localStorage.getItem('reload');
    if (reloadRoom) {
      setIsReload(true);
      messageApi.loading(t('settings.general.conf.reloading'));
      localStorage.removeItem('reload');
      // 等待5s进行重登陆
      setTimeout(async () => {
        const finalUserChoices = {
          username: userChoices.username,
          videoEnabled: false,
          audioEnabled: false,
          videoDeviceId: '',
          audioDeviceId: '',
        } as LocalUserChoices;
        await handlePreJoinSubmit(finalUserChoices);
        setIsReload(false);
        // router.push(`/${reloadRoom}`);
      }, 5000);
    }
  }, []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {contextHolder}
      {notHolder}
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
            joinLabel={t('common.join_room')}
            micLabel={t('common.device.microphone')}
            camLabel={t('common.device.camera')}
            userLabel={t('common.username')}
          />
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
          config={config}
          messageApi={messageApi}
          notApi={notApi}
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
  config: VocespaceConfig;
  messageApi: MessageInstance;
  notApi: NotificationInstance;
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

  const [permissionOpened, setPermissionOpened] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionDevice, setPermissionDevice] = useState<Track.Source | null>(null);
  const videoContainerRef = React.useRef<VideoContainerExports>(null);

  const resolutions = createRTCQulity(
    {
      resolution: props.config.resolution,
      maxBitrate: props.config.maxBitrate,
      maxFramerate: props.config.maxFramerate,
      priority: props.config.priority,
    },
    3,
  );

  const roomOptions = React.useMemo((): RoomOptions => {
    console.warn(props.config);
    let videoCodec: VideoCodec | undefined = props.config.codec ?? 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    return {
      videoCaptureDefaults: {
        deviceId: props.userChoices.videoDeviceId ?? undefined,
        resolution: props.options.hq ? resolutions[0] : resolutions[1],
      },
      publishDefaults: {
        dtx: false,
        videoSimulcastLayers: props.options.hq ? resolutions : [resolutions[1], resolutions[2]],
        red: !e2eeEnabled,
        videoCodec,
        screenShareEncoding: {
          maxBitrate: props.config.maxBitrate ?? 3000000, // 3Mbps
          maxFramerate: props.config.maxFramerate ?? 30, // 30fps
          priority: 'medium',
        },
        screenShareSimulcastLayers: props.options.hq
          ? [resolutions[0], resolutions[1]]
          : [resolutions[1], resolutions[2]],
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
  }, [props.userChoices, props.options.hq, props.options.codec, props.config]);

  const room = React.useMemo(() => new Room(roomOptions), []);
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

    if (TURN_CREDENTIAL !== '' && TURN_USERNAME !== '' && TURN_URL !== '') {
      conf.rtcConfig = {
        iceServers: [
          {
            urls: TURN_URL,
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL,
          },
        ],
        iceCandidatePoolSize: 20,
        iceTransportPolicy: 'all',
      };
    }

    return conf;
  }, []);

  const router = useRouter();
  const handleOnLeave = React.useCallback(async () => {
    socket.emit('mouse_remove', {
      space: room.name,
      senderName: room.localParticipant.name || room.localParticipant.identity,
      senderId: room.localParticipant.identity,
      receiverId: '',
      socketId: '',
    } as WsTo);
    await api.leaveSpace(room.name, room.localParticipant.identity, socket);
    await videoContainerRef.current?.clearRoom();
    socket.emit('update_user_status', {
      space: room.name,
    } as WsBase);
    socket.disconnect();
    router.push('/new_space');
  }, [router, room.localParticipant]);
  const handleError = React.useCallback((error: Error) => {
    console.error(`${t('msg.error.room.unexpect')}: ${error.message}`);
    if (error.name === 'ConnectionError') {
      props.messageApi.error(t('msg.error.room.network'));
    } else {
      console.error(error);
    }
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    props.messageApi.error(`${t('msg.error.room.unexpect')}: ${error.message}`);
  }, []);

  const handleMediaDeviceFailure = React.useCallback((fail?: MediaDeviceFailure) => {
    if (fail) {
      switch (fail) {
        case MediaDeviceFailure.DeviceInUse:
          props.messageApi.error(t('msg.error.device.in_use'));
          break;
        case MediaDeviceFailure.NotFound:
          props.messageApi.error(t('msg.error.device.not_found'));
          break;
        case MediaDeviceFailure.PermissionDenied:
          if (!permissionOpened) {
            setPermissionOpened(true);
            props.notApi.open({
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
          props.messageApi.error(t('msg.error.device.other'));
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
      props.messageApi.success(t('msg.success.device.granted'));

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
        onConnected={() => {
          videoContainerRef.current?.clearRoom();
        }}
      >
        <VideoContainer
          ref={videoContainerRef}
          chatMessageFormatter={formatChatMessageLinks}
          SettingsComponent={undefined}
          messageApi={props.messageApi}
          noteApi={props.notApi}
          setPermissionDevice={setPermissionDevice}
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
            <strong>{t('common.attention')}:</strong>{' '}
            {t('msg.request.device.permission.set_on_hand')}
          </p>
        </Modal>
      </LiveKitRoom>
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
  const isWeChat = navigator.userAgent.indexOf('MicroMessenger') > -1;

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
  } else if (isWeChat) {
    return (
      <ol>
        <li>{t('msg.request.device.permission.wechat.0')}</li>
        <li>{t('msg.request.device.permission.wechat.1')}</li>
        <li>{t('msg.request.device.permission.wechat.2')}</li>
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
