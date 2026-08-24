'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  Radio,
  Space,
  Steps,
  Switch,
  Typography,
  message,
  Result,
} from 'antd';
import {
  DEFAULT_VOCESPACE_CONFIG,
  ReadableConf,
  Resolution,
  VocespaceConfig,
} from '@/lib/std/conf';
import { useI18n } from '@/lib/i18n/i18n';

const { Title, Paragraph, Text } = Typography;

const cloneDefaultConfig = (): VocespaceConfig => {
  return JSON.parse(JSON.stringify(DEFAULT_VOCESPACE_CONFIG)) as VocespaceConfig;
};

/**
 * 从后端返回的可读配置构建完整配置。
 * ReadableConf 不含 redis/s3/hostToken 等敏感字段，其余字段以真实值为准，缺失的字段回退到默认值。
 */
const buildConfigFromReadable = (readable?: ReadableConf | null): VocespaceConfig => {
  const base = cloneDefaultConfig();
  if (!readable) {
    return base;
  }
  return {
    ...base,
    livekit: { ...base.livekit, ...readable.livekit },
    codec: readable.codec ?? base.codec,
    resolution: readable.resolution ?? base.resolution,
    maxBitrate: readable.maxBitrate ?? base.maxBitrate,
    maxFramerate: readable.maxFramerate ?? base.maxFramerate,
    priority: readable.priority ?? base.priority,
    serverUrl: readable.serverUrl ?? base.serverUrl,
    license: readable.license ?? base.license,
    create_space: readable.create_space ?? base.create_space,
    whiteList: readable.whiteList ?? base.whiteList,
    roomLicenses: readable.roomLicenses ?? base.roomLicenses,
    smtp: readable.smtp ? { ...base.smtp!, ...readable.smtp } : base.smtp,
    hyperbeam: readable.hyperbeam ? { ...base.hyperbeam!, ...readable.hyperbeam } : base.hyperbeam,
    ai: readable.ai ? { ...base.ai!, ...readable.ai } : base.ai,
  };
};

interface DashboardDriveProps {
  onSubmit: (conf: VocespaceConfig) => Promise<void>;
  loading?: boolean;
  /**
   * 后端返回的真实配置，用于回填表单真实值
   */
  conf?: ReadableConf | null;
  /**
   * 前置检测：true 表示服务器已存在并配置过 vocespace.conf.json
   */
  initialized?: boolean;
  /**
   * 用户在确认框中点击“取消”时的回调
   */
  onCancel?: () => void;
}

export const DashboardDrive: React.FC<DashboardDriveProps> = ({
  onSubmit,
  loading = false,
  conf,
  initialized,
  onCancel,
}) => {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const [current, setCurrent] = useState(0);
  const [config, setConfig] = useState<VocespaceConfig>(() => buildConfigFromReadable(conf));
  // 前置检测确认态：已初始化过的配置，先询问用户是否需要修改
  const [confirmedModify, setConfirmedModify] = useState(false);

  useEffect(() => {
    setConfig(buildConfigFromReadable(conf));
  }, [conf]);

  const steps = useMemo(
    () => [
      t('dashboard.drive.steps.base'),
      t('dashboard.drive.steps.media'),
      t('dashboard.drive.steps.service'),
      t('dashboard.drive.steps.review'),
    ],
    [t],
  );

  const resolutionOptions: Array<{ label: string; value: Resolution }> = [
    { label: '540p', value: '540p' },
    { label: '720p', value: '720p' },
    { label: '1080p', value: '1080p' },
    { label: '2k', value: '2k' },
    { label: '4k', value: '4k' },
  ];

  const validateStep = () => {
    if (current === 0) {
      if (
        !config.livekit.key.trim() ||
        !config.livekit.secret.trim() ||
        !config.livekit.url.trim() ||
        !config.serverUrl.trim() ||
        !config.hostToken.trim()
      ) {
        messageApi.error(t('dashboard.drive.validation.base'));
        return false;
      }
    }

    if (current === 2) {
      if (config.smtp && config.smtp.user && !config.smtp.pass) {
        messageApi.error(t('dashboard.drive.validation.smtp'));
        return false;
      }
    }

    return true;
  };

  const next = () => {
    if (!validateStep()) {
      return;
    }
    setCurrent((value) => Math.min(value + 1, steps.length - 1));
  };

  const prev = () => {
    setCurrent((value) => Math.max(value - 1, 0));
  };

  const submit = async () => {
    if (!config.license.trim()) {
      messageApi.error(t('dashboard.drive.validation.license'));
      return;
    }
    await onSubmit(config);
  };

  // 前置检测：服务器已配置过 vocespace.conf.json 时，先询问用户是否需要修改
  if (initialized === true && !confirmedModify) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 40,
        }}
      >
        {contextHolder}
        <Result
          status="warning"
          title={t('dashboard.drive.confirm_title')}
          subTitle={
            <Paragraph style={{ color: 'rgba(255,255,255,0.72)' }}>
              {t('dashboard.drive.confirm_desc')}
            </Paragraph>
          }
          extra={
            <>
              {onCancel && <Button onClick={onCancel}>{t('dashboard.drive.cancel')}</Button>}
              <Button type="primary" onClick={() => setConfirmedModify(true)}>
                {t('dashboard.drive.confirm_modify')}
              </Button>
            </>
          }
        ></Result>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {contextHolder}
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div>
          <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
            {t('dashboard.drive.title')}
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.72)', marginBottom: 0 }}>
            {t('dashboard.drive.desc')}
          </Paragraph>
        </div>

        <Alert
          type="warning"
          showIcon
          message={t('dashboard.drive.alert')}
          style={{ borderRadius: 12 }}
          closable
        ></Alert>

        <Card>
          <Steps
            current={current}
            items={steps.map((title) => ({
              title: <span style={{ color: '#ffffffc0' }}>{title}</span>,
            }))}
          ></Steps>
        </Card>

        {current === 0 && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Input
              addonBefore="LiveKit URL"
              value={config.livekit.url}
              onChange={(e) => {
                setConfig({
                  ...config,
                  livekit: { ...config.livekit, url: e.target.value },
                });
              }}
            ></Input>
            <Input
              addonBefore="LiveKit API Key"
              value={config.livekit.key}
              onChange={(e) => {
                setConfig({
                  ...config,
                  livekit: { ...config.livekit, key: e.target.value },
                });
              }}
            ></Input>
            <Input.Password
              addonBefore="LiveKit Secret"
              value={config.livekit.secret}
              onChange={(e) => {
                setConfig({
                  ...config,
                  livekit: { ...config.livekit, secret: e.target.value },
                });
              }}
            ></Input.Password>
            <Input
              addonBefore={t('dashboard.drive.server_url')}
              value={config.serverUrl}
              onChange={(e) => {
                setConfig({
                  ...config,
                  serverUrl: e.target.value,
                });
              }}
            ></Input>
            <Input.Password
              addonBefore={t('dashboard.drive.host_token')}
              value={config.hostToken}
              onChange={(e) => {
                setConfig({
                  ...config,
                  hostToken: e.target.value,
                });
              }}
            ></Input.Password>
          </Space>
        )}

        {current === 1 && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text style={{ color: '#fff' }}>{t('dashboard.drive.resolution')}</Text>
              <Radio.Group
                block
                optionType="button"
                value={config.resolution}
                onChange={(e) => {
                  setConfig({
                    ...config,
                    resolution: e.target.value,
                  });
                }}
                options={resolutionOptions}
                style={{ display: 'flex', marginTop: 8, flexWrap: 'wrap' }}
              ></Radio.Group>
            </div>
            <InputNumber
              addonBefore={t('dashboard.drive.max_bitrate')}
              style={{ width: '100%' }}
              min={100000}
              max={20000000}
              step={100000}
              value={config.maxBitrate}
              onChange={(value) => {
                setConfig({
                  ...config,
                  maxBitrate: value || 3000000,
                });
              }}
            ></InputNumber>
            <InputNumber
              addonBefore={t('dashboard.drive.max_framerate')}
              style={{ width: '100%' }}
              min={10}
              max={90}
              value={config.maxFramerate}
              onChange={(value) => {
                setConfig({
                  ...config,
                  maxFramerate: value || 30,
                });
              }}
            ></InputNumber>
            <Input
              addonBefore={t('dashboard.drive.redis_host')}
              value={config.redis.host}
              onChange={(e) => {
                setConfig({
                  ...config,
                  redis: { ...config.redis, host: e.target.value },
                });
              }}
            ></Input>
            <InputNumber
              addonBefore={t('dashboard.drive.redis_port')}
              style={{ width: '100%' }}
              min={1}
              max={65535}
              value={config.redis.port}
              onChange={(value) => {
                setConfig({
                  ...config,
                  redis: { ...config.redis, port: value || 6379 },
                });
              }}
            ></InputNumber>
          </Space>
        )}

        {current === 2 && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Input.Password
              addonBefore={t('dashboard.conf.smtp.pass')}
              value={config.smtp?.pass}
              onChange={(e) => {
                setConfig({
                  ...config,
                  smtp: {
                    ...config.smtp!,
                    pass: e.target.value,
                  },
                });
              }}
            ></Input.Password>
            <Input
              addonBefore={t('dashboard.conf.smtp.user')}
              value={config.smtp?.user}
              onChange={(e) => {
                setConfig({
                  ...config,
                  smtp: {
                    ...config.smtp!,
                    user: e.target.value,
                  },
                });
              }}
            ></Input>
            <Input
              addonBefore={t('dashboard.conf.smtp.from')}
              value={config.smtp?.from}
              onChange={(e) => {
                setConfig({
                  ...config,
                  smtp: {
                    ...config.smtp!,
                    from: e.target.value,
                  },
                });
              }}
            ></Input>
            <Input.Password
              addonBefore={t('dashboard.conf.hyperbeam.api_key')}
              value={config.hyperbeam?.apiKey}
              onChange={(e) => {
                setConfig({
                  ...config,
                  hyperbeam: {
                    ...config.hyperbeam!,
                    apiKey: e.target.value,
                  },
                });
              }}
            ></Input.Password>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#fff',
              }}
            >
              <span>{t('dashboard.drive.smtp_secure')}</span>
              <Switch
                checked={config.smtp?.secure}
                onChange={(checked) => {
                  setConfig({
                    ...config,
                    smtp: {
                      ...config.smtp!,
                      secure: checked,
                    },
                  });
                }}
              ></Switch>
            </div>
          </Space>
        )}

        {current === 3 && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Input.TextArea
              rows={16}
              value={JSON.stringify(config, null, 2)}
              onChange={(e) => {
                try {
                  setConfig(JSON.parse(e.target.value) as VocespaceConfig);
                } catch (_e) {
                  // keep editing text until valid json
                }
              }}
            ></Input.TextArea>
            <Paragraph style={{ marginBottom: 0, color: 'rgba(255,255,255,0.72)' }}>
              {t('dashboard.drive.review_desc')}
            </Paragraph>
          </Space>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          {current !== 0 && <Button onClick={prev}>{t('dashboard.drive.prev')}</Button>}
          <Space>
            {current < steps.length - 1 ? (
              <Button type="primary" onClick={next}>
                {t('dashboard.drive.next')}
              </Button>
            ) : (
              <Button type="primary" loading={loading} onClick={submit}>
                {t('dashboard.drive.submit')}
              </Button>
            )}
          </Space>
        </div>
      </Space>
    </div>
  );
};
