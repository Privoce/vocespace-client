'use client';

import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';
import { isSpaceManager } from '@/lib/std';
import { DEFAULT_VOCESPACE_CONFIG, VocespaceConfig } from '@/lib/std/conf';
import { SpaceInfo } from '@/lib/std/space';
import styles from '@/styles/controls.module.scss';
import { Button, Input, Radio } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import { LocalParticipant } from 'livekit-client';
import { useEffect, useMemo, useState } from 'react';

export interface AISettingProps {
  space: string;
  spaceInfo: SpaceInfo;
  localParticipant: LocalParticipant;
  messageApi: MessageInstance;
}

export function AISettings({ spaceInfo, localParticipant, messageApi, space }: AISettingProps) {
  const { t } = useI18n();
  const [model, setModel] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [config, setConfig] = useState(DEFAULT_VOCESPACE_CONFIG);
  const [enabled, setEnabled] = useState<boolean>(spaceInfo.ai.cut.enabled);
  const getConfig = async () => {
    const response = await api.getConf();
    if (response.ok) {
      const configData: VocespaceConfig = await response.json();
      setConfig(configData);
      setModel(configData.ai?.model || '');
      setUrl(configData.ai?.apiUrl || '');
      setApiKey(configData.ai?.apiKey || '');
    } else {
      console.error(t('msg.error.conf_load'));
    }
  };

  useEffect(() => {
    getConfig();
  }, []);

  const isOwner = useMemo(() => {
    return isSpaceManager(spaceInfo, localParticipant.identity || '').ty === "Owner";
  }, [localParticipant, spaceInfo]);

  const isUpdate = useMemo(() => {
    return (
      model !== config.ai?.model ||
      url !== config.ai?.apiUrl ||
      apiKey !== config.ai?.apiKey ||
      enabled !== spaceInfo.ai.cut.enabled
    );
  }, [model, url, apiKey, enabled, config, spaceInfo]);

  // 保存AI相关设置的更新，配置类设置需要使用接口更新
  const saveAIUpdate = async () => {
    if (model.trim() === '' || url.trim() === '' || apiKey.trim() === '') {
        messageApi.error(t('settings.ai.update.incomplete'));
        return;
    }

    try {
      if (model !== config.ai?.model || url !== config.ai?.apiUrl || apiKey !== config.ai?.apiKey) {
        const response = await api.updateAIConf({
          model,
          apiUrl: url,
          apiKey,
          enabled: config.ai?.enabled || true,
          maxTokens: config.ai?.maxTokens || 4000,
        });

        if (!response.ok) {
          throw new Error('AI config update failed');
        }
      }
      if (spaceInfo.ai.cut.enabled !== enabled) {
        const spaceResponse = await api.updateSpaceInfo(space, {
          ai: {
            cut: {
              ...spaceInfo.ai.cut,
              enabled: enabled,
            },
          },
        });

        if (!spaceResponse.ok) {
          throw new Error('Space AI setting update failed');
        }
      }
    } catch (e) {
      messageApi.error(t('settings.ai.update.error'));
    }
    messageApi.success(t('settings.ai.update.success'));
    await getConfig();
  };

  return (
    <div className={`${styles.setting_box} ${styles.scroll_box}`}>
      <div className={styles.common_space}>{t('settings.ai.desc')}</div>
      <div className={styles.common_space}>
        {t('settings.ai.recommand.0')}
        <div>{t('settings.ai.recommand.1')}</div>
        <div>{t('settings.ai.recommand.2')}</div>
        <div>{t('settings.ai.recommand.3')}</div>
        <div>{t('settings.ai.recommand.4')}</div>
        <div>{t('settings.ai.recommand.5')}</div>
      </div>
      <div className={styles.common_space}>{t('settings.ai.model')}:</div>
      <Input
        size="large"
        className={styles.common_space}
        value={model}
        onChange={(e: any) => {
          setModel(e.target.value);
        }}
      ></Input>
      {isOwner && (
        <>
          <div className={styles.common_space}>{t('settings.ai.key')}:</div>
          <Input.Password
            size="large"
            className={styles.common_space}
            value={apiKey}
            onChange={(e: any) => {
              setApiKey(e.target.value);
            }}
          ></Input.Password>
          <div className={styles.common_space}>{t('settings.ai.url')}:</div>
          <Input
            size="large"
            className={styles.common_space}
            value={url}
            onChange={(e: any) => {
              setUrl(e.target.value);
            }}
          ></Input>
          <div className={styles.common_space}>{t('settings.ai.enabled')}:</div>
          <Radio.Group
            size="large"
            block
            value={enabled}
            onChange={(e) => setEnabled(e.target.value)}
          >
            <Radio.Button value={true}>{t('common.open')}</Radio.Button>
            <Radio.Button value={false}>{t('common.close')}</Radio.Button>
          </Radio.Group>
        </>
      )}
      {isUpdate && isOwner && (
        <div className={styles.common_space}>
          <Button type="primary" onClick={saveAIUpdate} block size="large" className={styles.common_space}>
            {t('settings.ai.update.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
