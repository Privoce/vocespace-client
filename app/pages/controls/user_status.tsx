import { socket } from "@/app/[roomName]/PageClientImpl";
import { useI18n } from "@/lib/i18n/i18n";
import { connect_endpoint, UserDefineStatus } from "@/lib/std";
import { MessageInstance } from "antd/es/message/interface";
import { LocalParticipant } from "livekit-client";
import { useState } from "react";
import { ulid } from 'ulid';
import styles from '@/styles/controls.module.scss';
import TextArea from 'antd/es/input/TextArea';
import { Button, Input, Radio, Slider } from "antd";
import { SvgResource } from "@/app/resources/svg";

const SAVE_STATUS_ENDPOINT = connect_endpoint('/api/room-settings');

export function BuildUserStatus({
  messageApi,
  room,
  localParticipant,
}: {
  messageApi: MessageInstance;
  room: string;
  localParticipant: LocalParticipant;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const status_icons: {
    key: string;
    color: string;
  }[] = [
    {
      key: 'a',
      color: '#3357FF',
    },
    {
      key: 'b',
      color: '#0052d9',
    },
    {
      key: 'c',
      color: '#8e56dd',
    },
    {
      key: 'd',
      color: '#ffaedc',
    },
    {
      key: 'e',
      color: '#f5ba18',
    },
    {
      key: 'f',
      color: '#85d3ff',
    },
    {
      key: 'g',
      color: '#d54941',
    },
    {
      key: 'h',
      color: '#92dbb2',
    },
  ];
  const [selectedIcon, setSelectedIcon] = useState(status_icons[0].key);
  const [videoBlur, setVideoBlur] = useState(0.0);
  const [screenBlur, setScreenBlur] = useState(0.0);
  const [volume, setVolume] = useState(100);

  const saveStatus = async () => {
    try {
      const url = new URL(SAVE_STATUS_ENDPOINT, window.location.origin);

      const status: UserDefineStatus = {
        id: ulid(),
        creator: {
          name: localParticipant.name || localParticipant.identity,
          id: localParticipant.identity,
        },
        name,
        desc,
        icon: {
          key: selectedIcon,
          color: status_icons.find((item) => item.key == selectedIcon)?.color || '#3357FF',
        },
        volume,
        blur: videoBlur,
        screenBlur,
      };

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: room,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      messageApi.success({
        content: t('settings.general.status.define.success'),
      });
      // 服务器已经保存了状态，使用socket通知所有房间里的人
      socket.emit('new_user_status', { status: data.status, room: data.roomId });
      // 清空所有输入框
      setName('');
      setDesc('');
      setSelectedIcon(status_icons[0].key);
      setVolume(100);
      setVideoBlur(0.0);
      setScreenBlur(0.0);
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
          value={name}
          placeholder={t('settings.general.status.define.placeholder.name')}
          onChange={(e) => {
            setName(e.target.value);
          }}
        ></Input>
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.general.status.define.desc')}:</div>
        <TextArea
          rows={3}
          placeholder={t('settings.general.status.define.placeholder.desc')}
          value={desc}
          allowClear
          onChange={(e) => {
            setDesc(e.target.value);
          }}
          count={{
            show: true,
            max: 60,
          }}
        ></TextArea>
      </div>
      <div>
        <div className={styles.common_space}>{t('settings.general.status.define.icon')}:</div>
        <Radio.Group
          value={selectedIcon}
          size="large"
          onChange={(e) => {
            setSelectedIcon(e.target.value);
          }}
        >
          {status_icons.map((item, index) => (
            <Radio.Button value={item.key} key={index}>
              <SvgResource type="dot" svgSize={16} color={item.color}></SvgResource>
            </Radio.Button>
          ))}
        </Radio.Group>
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