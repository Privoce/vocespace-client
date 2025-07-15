import styles from '@/styles/controls.module.scss';
import { Button, Input, Radio, Select } from 'antd';
import { LangSelect } from '../lang_select';
import { StatusSelect } from '../status_select';
import { SvgResource } from '@/app/resources/svg';
import { BuildUserStatus } from '../user_status';
import { useI18n } from '@/lib/i18n/i18n';
import { LocalParticipant, Room } from 'livekit-client';
import { MessageInstance } from 'antd/es/message/interface';
import { isUndefinedNumber, isUndefinedString, UserStatus } from '@/lib/std';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_VOCESPACE_CONFIG, VocespaceConfig } from '@/lib/std/conf';
import api from '@/lib/api';
import { EnvConf } from '@/lib/std/env';
import equal from 'fast-deep-equal';
import { socket } from '@/app/[roomName]/PageClientImpl';
import { WsBase, WsSender } from '@/lib/std/device';

export interface GeneralSettingsProps {
  room: string;
  localParticipant: LocalParticipant;
  messageApi: MessageInstance;
  appendStatus: boolean;
  setAppendStatus: (append: boolean) => void;
  setUserStatus?: (status: UserStatus | string) => Promise<void>;
  username: string;
  setUsername: (username: string) => void;
  openPromptSound: boolean;
  setOpenPromptSound: (open: boolean) => void;
}

export function GeneralSettings({
  room,
  localParticipant,
  messageApi,
  appendStatus,
  setAppendStatus,
  setUserStatus,
  username,
  setUsername,
  openPromptSound,
  setOpenPromptSound,
}: GeneralSettingsProps) {
  const { t } = useI18n();
  const [reload, setReload] = useState(false);
  const [conf, setConf] = useState<EnvConf | null>(null);
  const originConf = useRef<EnvConf | null>(null);
  const getConf = async () => {
    const { resolution, maxBitrate, maxFramerate, priority } = await api.envConf();
    if (
      isUndefinedString(resolution) ||
      isUndefinedNumber(maxBitrate) ||
      isUndefinedNumber(maxFramerate) ||
      isUndefinedString(priority)
    ) {
      messageApi.error(t('voce_stream.conf_load_error'));
    } else {
      const data = {
        resolution: resolution!,
        maxBitrate: maxBitrate!,
        maxFramerate: maxFramerate!,
        priority: priority!,
      };
      setConf(data);
      originConf.current = data;
    }
  };

  useEffect(() => {
    getConf();
  }, []);

  useEffect(() => {
    if (equal(conf, originConf.current)) {
      setReload(false);
    } else {
      setReload(true);
    }
  }, [conf, originConf]);

  const resolutionOptions = [
    { label: '540p', value: '540p' },
    { label: '720p', value: '720p' },
    { label: '1080p', value: '1080p' },
    { label: '2k', value: '2k' },
    { label: '4K', value: '4K' },
  ];

  const reloadConf = async () => {
    if (conf) {
      const response = await api.reloadConf(conf);
      if (response.ok) {
        // socket 通知所有其他设备需要重新加载(包括自己)
        socket.emit('reload_env', {
          room,
        } as WsBase);
      } else {
        const { error } = await response.json();
        messageApi.error(`${t('voce_stream.reload_env_error')}: ${error}`);
      }
    }
  };

  return (
    <div className={styles.setting_box}>
      <div>{t('settings.general.username')}:</div>
      <Input
        size="large"
        className={styles.common_space}
        value={username}
        onChange={(e: any) => {
          setUsername(e.target.value);
        }}
      ></Input>
      <div className={styles.common_space}>{t('settings.general.lang')}:</div>
      <LangSelect style={{ width: '100%' }}></LangSelect>
      <div className={styles.common_space}>{t('settings.general.status.title')}:</div>
      <div className={styles.setting_box_line}>
        <StatusSelect
          style={{ width: 'calc(100% - 52px)' }}
          setUserStatus={setUserStatus}
        ></StatusSelect>
        <Button
          disabled
          type="primary"
          shape="circle"
          onClick={() => {
            setAppendStatus(!appendStatus);
          }}
        >
          <SvgResource type="add" svgSize={16}></SvgResource>
        </Button>
      </div>
      {appendStatus && (
        <BuildUserStatus
          messageApi={messageApi}
          room={room}
          localParticipant={localParticipant}
        ></BuildUserStatus>
      )}
      <div className={styles.common_space}>{t('settings.general.prompt_sound')}:</div>
      <Radio.Group
        block
        value={openPromptSound}
        onChange={(e) => {
          setOpenPromptSound(e.target.value);
        }}
      >
        <Radio.Button value={true}>{t('common.open')}</Radio.Button>
        <Radio.Button value={false}>{t('common.close')}</Radio.Button>
      </Radio.Group>
      {conf ? (
        <>
          <div className={styles.common_space}>{t('voce_stream.resolution')}:</div>
          <Select
            size="large"
            options={resolutionOptions}
            style={{ width: '100%' }}
            value={conf.resolution}
            onChange={(value) => {
              setConf({ ...conf, resolution: value });
            }}
          ></Select>
          <div className={styles.common_space}>{t('voce_stream.maxBitrate')}:</div>
          <Input
            size="large"
            className={styles.common_space}
            value={conf.maxBitrate}
            onChange={(e: any) => {
              setConf({ ...conf, maxBitrate: e.target.value });
            }}
          ></Input>
          <div className={styles.common_space}>{t('voce_stream.maxFramerate')}:</div>
          <Input
            size="large"
            className={styles.common_space}
            value={conf.maxFramerate}
            onChange={(e: any) => {
              setConf({ ...conf, maxFramerate: e.target.value });
            }}
          ></Input>
          {reload && (
            <Button
              type="primary"
              block
              onClick={reloadConf}
              className={styles.common_space}
              size="large"
            >
              {t('voce_stream.reload')}
            </Button>
          )}
        </>
      ) : (
        <span>cuowu </span>
      )}
    </div>
  );
}
