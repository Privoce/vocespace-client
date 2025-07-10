'use client';

import { VideoContainer, VideoContainerExports } from '@/app/pages/controls/video_container';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { useI18n } from '@/lib/i18n/i18n';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { ConnectionDetails } from '@/lib/types';
import { formatChatMessageLinks, LiveKitRoom, LocalUserChoices } from '@livekit/components-react';
import { Button, message, Modal, notification, Space } from 'antd';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  MediaDeviceFailure,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { PreJoin } from '@/app/pages/pre_join/pre_join';
import { atom, RecoilRoot, useRecoilState } from 'recoil';
import { connect_endpoint, UserDefineStatus, UserStatus } from '@/lib/std';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import io from 'socket.io-client';
import { EnvConf } from '@/lib/std/env';

// h90: '160x90 (QQVGA)',
// h180: '320x180 (HQVGA)',
// h216: '384x216 (WQVGA)',
// h360: '640x360 (nHD)',
// h540: '960x540 (qHD)',
// h720: '1280x720 (HD)',
// h1080: '1920x1080 (Full HD / 1080p)',
// h1440: '2560x1440 (QHD / 2K)',
// h2160: '3840x2160 (UHD / 4K)',

const {
  TURN_CREDENTIAL = '',
  TURN_USERNAME = '',
  TURN_URL = '',
} = process.env;

export const socket = io();

export const userState = atom({
  key: 'userState',
  default: {
    volume: 100,
    blur: 0.0,
    screenBlur: 0.0,
    virtual: {
      enabled: false,
      role: ModelRole.None,
      bg: ModelBg.ClassRoom,
    },
    status: UserStatus.Online as string,
    // rpc: {
    //   wave: false,
    // },
    roomStatus: [] as UserDefineStatus[],
  },
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

const CONN_DETAILS_ENDPOINT = connect_endpoint(
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details',
);
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const { t } = useI18n();
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
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
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
  }, []);
  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  return (
    <RecoilRoot>
      <main data-lk-theme="default" style={{ height: '100%' }}>
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
          />
        )}
      </main>
    </RecoilRoot>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
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
  const videoContainerRef = React.useRef<VideoContainerExports>(null);
  const [screenShareOption, setScreenShareOption] = React.useState<EnvConf | null>(null);
  const fetchEnvConf = useCallback(async () => {
    const url = new URL(connect_endpoint('/api/env'), window.location.origin);
    const response = await fetch(url.toString());
    if (!response.ok) {
      return {
        resolution: '1080p',
        maxBitrate: 12000,
        maxFramerate: 30,
        priority: 'medium' as RTCPriorityType,
      } as EnvConf;
    } else {
      const { resolution, maxBitrate, maxFramerate, priority }: EnvConf = await response.json();
      return {
        resolution,
        maxBitrate,
        maxFramerate,
        priority,
      } as EnvConf;
    }
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
      case 'h2160':
      case 'UHD':
        return {
          h: VideoPresets.h2160,
          l: VideoPresets.h1440,
        };
      case '2k':
      case 'h1440':
      case 'QHD':
        return {
          h: VideoPresets.h1440,
          l: VideoPresets.h1080,
        };
      case '1080p':
      case 'h1080':
      case 'Full HD':
        return {
          h: VideoPresets.h1080,
          l: VideoPresets.h720,
        };
      case '720p':
      case 'h720':
      case 'HD':
        return {
          h: VideoPresets.h720,
          l: VideoPresets.h540,
        };
      case '540p':
      case 'h540':
      case 'qHD':
        return {
          h: VideoPresets.h540,
          l: VideoPresets.h360,
        };
      case '360p':
      case 'h360':
      case 'nHD':
        return {
          h: VideoPresets.h360,
          l: VideoPresets.h216,
        };
      case '216p':
      case 'h216':
      case 'WQVGA':
        return {
          h: VideoPresets.h216,
          l: VideoPresets.h180,
        };
      case '180p':
      case 'h180':
      case 'HQVGA':
        return {
          h: VideoPresets.h180,
          l: VideoPresets.h90,
        };
      case '90p':
      case 'h90':
      case 'QQVGA':
        return {
          h: VideoPresets.h90,
          l: VideoPresets.h90,
        };
      default:
        return {
          h: VideoPresets.h1080,
          l: VideoPresets.h720,
        };
    }
  }, [screenShareOption]);

  const roomOptions = React.useMemo((): RoomOptions => {
    console.warn(screenShareOption);
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    return {
      videoCaptureDefaults: {
        deviceId: props.userChoices.videoDeviceId ?? undefined,
        resolution: props.options.hq ? resolutions.h : resolutions.l,
      },
      publishDefaults: {
        dtx: false,
        videoSimulcastLayers: props.options.hq ? [resolutions.h, resolutions.l] : [resolutions.l],
        red: !e2eeEnabled,
        videoCodec,
        screenShareEncoding: {
          maxBitrate: screenShareOption?.maxBitrate || 12000,
          maxFramerate: screenShareOption?.maxFramerate || 30,
          priority: screenShareOption?.priority || 'medium',
        },
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
  }, [
    props.userChoices,
    props.options.hq,
    props.options.codec,
    screenShareOption,
    resolutions
  ]);

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
      room: room.name,
      senderName: room.localParticipant.name || room.localParticipant.identity,
      senderId: room.localParticipant.identity,
      receiverId: '',
      receSocketId: '',
    });
    await videoContainerRef.current?.removeLocalSettings();
    socket.disconnect();
    router.push('/');
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
          // 可以选择性地重新启用摄像头或麦克风
          await room.localParticipant.setCameraEnabled(true);
          await room.localParticipant.setMicrophoneEnabled(true);
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
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
          ></VideoContainer>
          {/* <DebugMode /> */}
          <RecordingIndicator />
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
