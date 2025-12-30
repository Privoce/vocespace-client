'use client';

import { AICutDeps } from '@/lib/ai/analysis';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';
import { isSpaceManager } from '@/lib/std';
import { DEFAULT_VOCESPACE_CONFIG, ReadableConf } from '@/lib/std/conf';
import { ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import styles from '@/styles/controls.module.scss';
import { Button, Input, Radio } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import { LocalParticipant, Room } from 'livekit-client';
import { useEffect, useMemo, useState } from 'react';
import { AICutAnalysisSettingsPanel, useAICutAnalysisSettings } from '../widgets/ai';

export interface AISettingProps {
  space: Room;
  spaceInfo: SpaceInfo;
  localParticipant: LocalParticipant;
  messageApi: MessageInstance;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
}

export function AISettings({
  spaceInfo,
  localParticipant,
  messageApi,
  space,
  updateSettings,
}: AISettingProps) {
  const [preCheck, setPreCheck] = useState<boolean>(false);
  const [hostToken, setHostToken] = useState<string>('');
  const { t } = useI18n();
  const [model, setModel] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [config, setConfig] = useState(DEFAULT_VOCESPACE_CONFIG);
  const {
    aiCutDeps,
    setAICutDeps,
    extraction,
    setExtraction,
    cutFreq,
    setCutFreq,
    cutBlur,
    setCutBlur,
    isServiceOpen: enabled,
    setIsServiceOpen,
    aiCutOptions,
    aiCutOptionsChange,
  } = useAICutAnalysisSettings({
    space,
    spaceInfo,
  });

  const getConfig = async (preCheck: boolean, hostToken: string) => {
    if (preCheck && hostToken.trim() !== '') {
      const response = await api.getConf(hostToken);
      if (response.ok) {
        const configData: ReadableConf = await response.json();
        setConfig(configData);
        setModel(configData.ai?.model || '');
        setUrl(configData.ai?.apiUrl || '');
        setApiKey(configData.ai?.apiKey || '');
      } else {
        console.error(t('msg.error.conf_load'));
      }
    }
  };

  const isOwner = useMemo(() => {
    return isSpaceManager(spaceInfo, localParticipant.identity || '').ty === 'Owner';
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
        const spaceResponse = await api.updateSpaceInfo(space.name, {
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
    setPreCheck(false);
    setHostToken('');
  };

  // 验证host token, 需要把hostToken发送到后端进行验证
  const checkHostToken = async () => {
    const response = await api.checkHostToken(hostToken);
    if (response.ok) {
      const { success } = await response.json();
      if (success) {
        setPreCheck(true);
        messageApi.success(t('settings.ai.precheck.success'));
        await getConfig(true, hostToken);
        return;
      }
    }
    messageApi.error(t('settings.ai.precheck.error'));
  };

  const saveAICutSettings = async () => {
    if (cutFreq !== spaceInfo.ai.cut.freq) {
      const response = await api.updateSpaceInfo(space.name, {
        ai: {
          cut: {
            ...spaceInfo.ai.cut,
            freq: cutFreq,
          },
        },
      });

      if (!response.ok) {
        let { error } = await response.json();
        messageApi.error(error);
        return;
      }
    }

    if (
      spaceInfo.participants[localParticipant.identity].ai.cut.extraction !== extraction ||
      spaceInfo.participants[localParticipant.identity].ai.cut.spent !==
        aiCutDeps.includes('spent') ||
      spaceInfo.participants[localParticipant.identity].ai.cut.todo !== aiCutDeps.includes('todo')
    ) {
      const update = await updateSettings({
        ai: {
          cut: {
            ...spaceInfo.participants[localParticipant.identity].ai.cut,
            extraction: extraction,
            spent: aiCutDeps.includes('spent'),
            todo: aiCutDeps.includes('todo'),
            blur: cutBlur,
          },
        },
      });

      if (!update) {
        messageApi.error(t('settings.ai.update.error'));
        return;
      }
    }

    messageApi.success(t('settings.ai.update.success'));
  };

  return (
    <div className={`${styles.setting_box} ${styles.scroll_box}`}>
      <div className={styles.common_space}>{t('settings.ai.desc')}</div>

      <AICutAnalysisSettingsPanel
        space={space}
        spaceInfo={spaceInfo}
        aiCutDeps={aiCutDeps}
        setAICutDeps={setAICutDeps}
        extraction={extraction}
        setExtraction={setExtraction}
        cutFreq={cutFreq}
        setCutFreq={setCutFreq}
        cutBlur={cutBlur}
        setCutBlur={setCutBlur}
        isServiceOpen={enabled}
        setIsServiceOpen={setIsServiceOpen}
        aiCutOptions={aiCutOptions}
        aiCutOptionsChange={aiCutOptionsChange}
        isPanel={false}
      ></AICutAnalysisSettingsPanel>

      <div className={styles.common_space}>
        <Button
          type="primary"
          block
          className={styles.common_space}
          size="large"
          onClick={saveAICutSettings}
        >
          {t('settings.ai.update.save')}
        </Button>
      </div>
      {preCheck ? (
        <>
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
                onChange={(e) => setIsServiceOpen(e.target.value)}
              >
                <Radio.Button value={true}>{t('common.open')}</Radio.Button>
                <Radio.Button value={false}>{t('common.close')}</Radio.Button>
              </Radio.Group>
            </>
          )}
          {isUpdate && isOwner && (
            <div className={styles.common_space}>
              <Button
                type="primary"
                onClick={saveAIUpdate}
                block
                size="large"
                className={styles.common_space}
              >
                {t('settings.ai.update.save')}
              </Button>
            </div>
          )}
        </>
      ) : (
        // 要修改AI设置需要先输入host token进行验证，所以只有软件的部署者或被授权的人才能修改AI设置，否则会导致API密钥泄露
        <>
          <div className={styles.common_space}>{t('settings.ai.precheck.desc')}</div>
          <Input
            size="large"
            placeholder={t('settings.ai.precheck.placeholder')}
            value={hostToken}
            onChange={(e) => {
              setHostToken(e.target.value);
            }}
          ></Input>
          <div className={styles.common_space}>
            <Button
              type="primary"
              onClick={checkHostToken}
              block
              size="large"
              className={styles.common_space}
            >
              {t('settings.ai.precheck.check')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
