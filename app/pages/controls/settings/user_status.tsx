import { socket } from '@/app/[spaceName]/PageClientImpl';
import { useI18n } from '@/lib/i18n/i18n';
import { UserDefineStatus } from '@/lib/std';
import { MessageInstance } from 'antd/es/message/interface';
import { LocalParticipant } from 'livekit-client';
import { useState } from 'react';
import { ulid } from 'ulid';
import styles from '@/styles/controls.module.scss';
import { Button, Input, Radio, Slider } from 'antd';
import { api } from '@/lib/api';
import { DefineUserStatusResponse } from '@/lib/api/space';
import { WsBase } from '@/lib/std/device';

export interface BuildUserStatusProps {
  messageApi: MessageInstance;
  space: string;
  localParticipant: LocalParticipant;
}

/**
 * ## 用户状态构建组件
 * 用于构建用户自定义状态。包含状态名称、描述、图标选择、音量、视频模糊度和屏幕模糊度的设置。
 * - 用户状态可以在空间内共享，其他用户可以看到。每个用户都有自己的状态，默认为online状态。
 * - 自定义状态是当用户想要特定的状态(非系统状态)时进行设置，用户自定义的状态会同步到空间中，变成空间中其他用户可选的新状态。
 * - 用户自定义状态还可以在用户自己创建的子房间中设置为子房间的统一状态，这意味着其他加入到子房间的用户都会同步到这个状态(默认)，
 * 除非其他用户自己更改到其他状态。
 */
export function BuildUserStatus({ messageApi, space, localParticipant }: BuildUserStatusProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');

  const [videoBlur, setVideoBlur] = useState(0.0);
  const [screenBlur, setScreenBlur] = useState(0.0);
  const [volume, setVolume] = useState(100);

  // 恢复默认状态
  const restoreAll = () => {
    setName('');
    setVolume(100);
    setVideoBlur(0.0);
    setScreenBlur(0.0);
  };

  const saveStatus = async () => {
    try {
      const status: UserDefineStatus = {
        id: ulid(),
        creator: {
          name: localParticipant.name || localParticipant.identity,
          id: localParticipant.identity,
        },
        title: name,
        volume,
        blur: videoBlur,
        screenBlur,
      };
      // 发送到服务器保存状态
      const response = await api.defineUserStatus(space, status);
      if (!response.ok) {
        throw new Error(`Failed to save status: ${response.status}`);
      }
      const data: DefineUserStatusResponse = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      messageApi.success({
        content: t('settings.general.status.define.success'),
      });
      // 服务器已经保存了状态，使用socket通知所有房间里的人
      // socket.emit('new_user_status', { status: data.status, room: data.spaceName });
      socket.emit('update_user_status', {
        space: data.spaceName,
      } as WsBase);
      restoreAll();
    } catch (e) {
      messageApi.error({
        content: `${t('settings.general.status.define.fail')}: ${e}`,
      });
    }
  };

  return (
    <div className={styles.build_status}>
      <hr />
      <h4 style={{ fontSize: '16px', color: '#fff' }}>
        {t('settings.general.status.define.title')}
      </h4>
      <div>
        <div className={styles.common_space}>{t('settings.general.status.define.name')}:</div>
        <Input
          size="large"
          value={name}
          placeholder={t('settings.general.status.define.placeholder.name')}
          onChange={(e) => {
            setName(e.target.value);
          }}
        ></Input>
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.audio.volume')}:</div>
        <Slider
          value={volume}
          min={0.0}
          max={100.0}
          step={1}
          onChange={(e) => {
            setVolume(e);
          }}
        />
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.video.video_blur')}:</div>
        <Slider
          className={`${styles.slider}`}
          value={videoBlur}
          min={0.0}
          max={1.0}
          step={0.05}
          onChange={(e) => {
            setVideoBlur(e);
          }}
        />
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.video.screen_blur')}:</div>
        <Slider
          className={`${styles.slider}`}
          value={screenBlur}
          min={0.0}
          max={1.0}
          step={0.05}
          onChange={(e) => {
            setScreenBlur(e);
          }}
        />
      </div>

      <Button style={{ width: '100%', margin: '8px 0' }} type="primary" onClick={saveStatus}>
        {t('settings.general.status.define.save')}
      </Button>
    </div>
  );
}
