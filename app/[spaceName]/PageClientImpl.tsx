'use client';

import { useRoomConnection } from '@/features/room/hooks/use-room-connection';
import { useRoomEntry } from '@/features/room/hooks/use-room-entry';
import type { PageClientImplProps } from '@/features/room/types';
import BeforeUnloadGuard from '@/app/BeforeUnloadGuard';
import { VideoContainer, VideoContainerExports } from '@/app/pages/controls/video_container';
import { useI18n } from '@/lib/i18n/i18n';
import { RecordingIndicator } from './RecordingIndicator';
import type { ConnectionDetails } from '@/lib/types';
import { formatChatMessageLinks, LiveKitRoom, type LocalUserChoices } from '@livekit/components-react';
import { Button, Modal, Space } from 'antd';
import { type Room, type RoomConnectOptions, type VideoCodec, MediaDeviceFailure, Track } from 'livekit-client';
import React, { useState } from 'react';
import { PreJoin } from '@/app/pages/pre_join/pre_join';
import { useSocketSession } from '@/lib/hooks/use-socket-session';
import { useRoomLeave } from '@/features/room/hooks/use-room-leave';
import type { ReadableConf } from '@/lib/std/conf';
import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';

export function PageClientImpl(props: PageClientImplProps) {
  const { data, loading, setLoading, spaceName, codec, hq, messageApi } = props;
  const { t, notApi, notHolder, connectionDetails, preJoinChoices, preJoinDefaults,
    handlePreJoinSubmit, handlePreJoinError, config, configReady, configError, retryConfig } = useRoomEntry(props);
  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {notHolder}
      {configError ? (
        <div role="alert"><p>{t('msg.error.conf_load')}</p><Button onClick={retryConfig}>{t('common.try_again')}</Button></div>
      ) : !configReady || connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
            joinLabel={t('common.join_room')}
            micLabel={t('common.device.microphone')}
            camLabel={t('common.device.camera')}
            userLabel={t('common.username')}
            data={data}
            loading={loading || !configReady}
            setLoading={setLoading}
            space={spaceName}
            config={config}
          />
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{
            codec: codec || 'vp9',
            hq: hq === undefined ? true : typeof hq === 'string' ? Boolean(hq) : hq,
          }}
          config={config}
          messageApi={messageApi}
          notApi={notApi}
        />
      )}
    </main>
  );
}

interface VideoConferenceProps {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
  config: ReadableConf;
  messageApi: MessageInstance;
  notApi: NotificationInstance;
}

function VideoConferenceComponent(props: VideoConferenceProps) {
  const { t } = useI18n();
  const connection = useRoomConnection({ ...props,
    onError: (error) => { console.error(error); props.messageApi.error(t('msg.error.e2ee.unsupport')); },
  });
  if (!connection.room) return null;
  return <ConnectedConference {...props} connection={{ ...connection, room: connection.room }} />;
}

function ConnectedConference(props: VideoConferenceProps & {
  connection: { room: Room; connectOptions?: RoomConnectOptions; e2eeSetupComplete: boolean };
}) {
  useSocketSession();
  const { t } = useI18n();
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionDevice, setPermissionDevice] = useState<Track.Source | null>(null);
  const [shouldConfirmLeave, setShouldConfirmLeave] = useState(false);
  const permissionNoticeShownRef = React.useRef(false);
  const videoContainerRef = React.useRef<VideoContainerExports>(null);
  const { room, connectOptions, e2eeSetupComplete } = props.connection;

  const handleOnLeave = useRoomLeave(room, videoContainerRef, setShouldConfirmLeave);
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

  const handleMediaDeviceFailure = React.useCallback(
    (fail?: MediaDeviceFailure) => {
      if (fail) {
        switch (fail) {
          case MediaDeviceFailure.DeviceInUse:
            props.messageApi.error(t('msg.error.device.in_use'));
            break;
          case MediaDeviceFailure.NotFound:
            props.messageApi.error(t('msg.error.device.not_found'));
            break;
          case MediaDeviceFailure.PermissionDenied:
            if (
              !permissionNoticeShownRef.current &&
              !permissionModalVisible &&
              (permissionDevice === Track.Source.Camera ||
                permissionDevice === Track.Source.Microphone)
            ) {
              permissionNoticeShownRef.current = true;
              props.notApi.open({
                duration: 3,
                message: t('msg.error.device.permission_denied_title'),
                description: t('msg.error.device.permission_denied_desc'),
                btn: (
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => {
                        setPermissionModalVisible(true);
                      }}
                    >
                      {t('msg.request.device.allow')}
                    </Button>
                  </Space>
                ),
              });
            }
            break;
          case MediaDeviceFailure.Other:
            props.messageApi.error(t('msg.error.device.other'));
            break;
        }
      }
    },
    [permissionDevice, permissionModalVisible, props.messageApi, props.notApi, t],
  );

  // 请求权限的函数 - 将在用户点击按钮时直接触发
  const requestMediaPermissions = async () => {
    // 重置状态
    setPermissionError(null);
    setPermissionRequested(true);

    try {
      // 请求媒体权限
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());

      // 权限已获取，通知用户
      props.messageApi.success(t('msg.success.device.granted'));
      permissionNoticeShownRef.current = false;

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
      <BeforeUnloadGuard enabled={shouldConfirmLeave} />
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
          setShouldConfirmLeave(true);
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
          config={props.config}
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
                  <BrowserSpecificInstructions />
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

function BrowserSpecificInstructions() {
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
