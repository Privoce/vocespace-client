'use client';

import { VideoContainer, VideoContainerExports } from '@/app/devices/video_container';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { useI18n } from '@/lib/i18n/i18n';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
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
  RpcInvocationData,
  ConnectionState,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import React, { createContext, ReactNode, useState } from 'react';
import { PreJoin } from '@/app/pages/pre_join/pre_join';
import { atom, RecoilRoot, useRecoilState } from 'recoil';
import { connect_endpoint, UserDefineStatus, UserStatus } from '@/lib/std';
import { ModelBg, ModelRole } from '@/lib/std/virtual';
import io from 'socket.io-client';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_PATH
  ? {
      path: process.env.NEXT_PUBLIC_BASE_PATH,
    }
  : {};

export const socket = io();

export const userState = atom({
  key: 'userState',
  default: {
    volume: 100,
    blur: 0.0,
    screenBlur: 0.0,
    virtualRole: {
      enabled: false,
      role: ModelRole.None,
      bg: ModelBg.ClassRoom,
    },
    status: UserStatus.Online as string,
    rpc: {
      wave: false,
    },
    roomStatus: [] as UserDefineStatus[],
  },
});

export const roomIdTmpState = atom({
  key: 'roomIdTmpState',
  default: '',
});

export const virtualMaskState = atom({
  key: 'virtualMaskState',
  default: false
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
  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    return {
      videoCaptureDefaults: {
        deviceId: props.userChoices.videoDeviceId ?? undefined,
        resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h1080,
      },
      publishDefaults: {
        dtx: false,
        videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1440, VideoPresets.h1080]
        : [VideoPresets.h1080],
        red: !e2eeEnabled,
        videoCodec,
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
  }, [props.userChoices, props.options.hq, props.options.codec]);

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
    return {
      maxRetries: 5,
      autoSubscribe: true,
    };
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
        <DebugMode />
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
