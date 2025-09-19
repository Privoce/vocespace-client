'use client';
import { licenseState, socket } from '@/app/[spaceName]/PageClientImpl';
import { useI18n } from '@/lib/i18n/i18n';
import styles from '@/styles/controls.module.scss';
import { Button, Descriptions, Input, Modal, Radio, RadioChangeEvent, Tag } from 'antd';
import { CheckboxGroupProps } from 'antd/es/checkbox';
import TextArea from 'antd/es/input/TextArea';
import { MessageInstance } from 'antd/es/message/interface';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';
import { Calendly } from '../widgets/calendly';
import { api } from '@/lib/api';
import {
  analyzeLicense,
  getLicensePersonLimit,
  LicenseStatus,
  licenseStatus,
  validLicenseDomain,
} from '@/lib/std/license';
import { PresetStatusColorType } from 'antd/es/_util/colors';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { DEFAULT_VOCESPACE_CONFIG, VocespaceConfig } from '@/lib/std/conf';
import { WsBase } from '@/lib/std/device';

type ModelKey = 'update' | 'renew' | 'server';
type OptionValue = 'renew' | 'custom';

export function LicenseControl({
  messageApi,
  space,
}: {
  messageApi: MessageInstance;
  space: string;
}) {
  const { t } = useI18n();
  const [userLicense, setUserLicense] = useRecoilState(licenseState);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calendlyOpen, setCalendlyOpen] = useState(false);
  const [key, setKey] = useState<ModelKey>('renew');
  const [value, setValue] = useState<OptionValue>('renew');
  const [licenseValue, setLicenseValue] = useState<string>('');
  const [config, setConfig] = useState(DEFAULT_VOCESPACE_CONFIG);
  const [ipAddress, setIpAddress] = useState<string | undefined>(undefined);
  const getConfig = async () => {
    const response = await api.getConf();
    if (response.ok) {
      const configData: VocespaceConfig = await response.json();
      setConfig(configData);
      setIpAddress(configData.serverUrl);
    } else {
      console.error(t('msg.error.conf_load'));
    }
  };

  useEffect(() => {
    if (!ipAddress) {
      getConfig();
    }
  }, [ipAddress]);

  const okText = useMemo(() => {
    if (key === 'renew') {
      if (value === 'renew') {
        return t('settings.license.buy');
      } else {
        return t('settings.license.meeting');
      }
    } else if (key === 'update') {
      return t('settings.license.update');
    } else {
      return t('settings.license.buy');
    }
  }, [key, value]);

  const modelTitle = useMemo(() => {
    switch (key) {
      case 'renew':
        return t('settings.license.renew');
      case 'update':
        return t('settings.license.update');
      default:
        return t('settings.license.renew');
    }
  }, [key]);

  const toBuyPage = async () => {
    if (isCircleIp) {
      window.open('https://buy.stripe.com/bJeaEX9ex2PUer2aLe6c00O', '_blank');
    } else {
      // 请求 在space.voce.chat/api/webhook?session_ip=IP, 让官方服务器通过stripe的api获取用户的session
      // 然后用户侧获取到session.url进行跳转
      const response = await api.getLicenseByIP(config.serverUrl);
      if (response.ok) {
        const { url } = await response.json();
        if (url) {
          window.open(url, '_blank');
        } else {
          window.open('https://buy.stripe.com/bJeaEX9ex2PUer2aLe6c00O', '_blank');
        }
      } else {
        messageApi.warning({
          content: 'Failed to get session url',
          duration: 2,
        });
        window.open('https://buy.stripe.com/bJeaEX9ex2PUer2aLe6c00O', '_blank');
      }
    }
  };

  const fmtDate = (date: Date): string => {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const items = useMemo(() => {
    let items = [
      {
        key: 1,
        label: t('settings.license.signed'),
        children: userLicense.isAnalysis ? 'Yes' : 'No',
      },
      {
        key: 2,
        label: t('settings.license.domains'),
        children: userLicense.domains,
      },
      {
        key: 3,
        label: t('settings.license.limit'),
        children: userLicense.limit,
      },
      {
        key: 4,
        label: t('settings.license.person'),
        children: getLicensePersonLimit(userLicense.limit, userLicense.isTmp).toString(),
      },
      {
        key: 5,
        label: t('settings.license.created_at'),
        children: fmtDate(new Date(userLicense.created_at * 1000)),
      },
      {
        key: 6,
        label: t('settings.license.expires_at'),
        children: fmtDate(new Date(userLicense.expires_at * 1000)),
      },
      {
        key: 7,
        label: t('settings.license.value'),
        children: userLicense.value,
      },
    ];
    const now_timestamp = new Date().getTime();
    const valid = userLicense.value !== '' && userLicense.expires_at < now_timestamp;
    const status = licenseStatus(userLicense);
    const { color, text: statusText, icon: statusIcon } = licenseStatusTag(status);
    return (
      <Descriptions
        title={
          <>
            <span>{t('settings.license.title')}</span>
            <Tag style={{ marginLeft: 16 }} color={color} icon={statusIcon}>
              {statusText}
            </Tag>
          </>
        }
        bordered
        column={1}
        styles={{
          label: { color: valid ? '#8c8c8c' : '#fdd', minWidth: '120px' },
        }}
        items={items}
      />
    );
  }, [userLicense, t]);

  const options: CheckboxGroupProps<string>['options'] = [
    {
      label: t('settings.license.license_pro'),
      value: 'renew',
    },
    {
      label: t('settings.license.license_custom'),
      value: 'custom',
    },
  ];

  const onChange = ({ target: { value } }: RadioChangeEvent) => {
    setValue(value);
  };

  const onOk = async () => {
    if (key === 'renew') {
      if (value === 'renew') {
        // renew license
        if (isCircleIp) {
          setKey('server');
        } else {
          toBuyPage();
        }
      } else {
        setIsModalOpen(false);
        setCalendlyOpen(true);
        return;
      }
    } else if (key === 'update') {
      // 使用本地校验的方式验证证书合理性
      let isDefault = false;

      let validatedLicense = analyzeLicense(licenseValue, (_e) => {
        isDefault = true;
        messageApi.error({
          content: t('settings.license.invalid') + t('settings.license.default_license'),
          duration: 8,
        });
        return;
      });
      if (!isDefault) {
        if (!validLicenseDomain(validatedLicense.domains, config.serverUrl)) {
          messageApi.error({
            content: t('settings.license.invalid_domain'),
            duration: 3,
          });
          return;
        }
      }

      const response = await api.reloadLicense(licenseValue);
      if (response.ok) {
        setUserLicense({
          ...validatedLicense,
          isAnalysis: true,
          personLimit: getLicensePersonLimit(validatedLicense.limit, validatedLicense.isTmp),
        });
        setIsModalOpen(false);
        setLicenseValue('');
        messageApi.success({
          content: t('settings.license.update_success'),
          duration: 2,
        });
        setTimeout(() => {
          // socket 通知所有其他设备需要重新加载(包括自己)
          socket.emit('reload_env', {
            space,
          } as WsBase);
        }, 2000);
      } else {
        const { error } = await response.json();
        messageApi.error({
          content: error || t('settings.license.invalid'),
          duration: 4,
        });
      }
    } else {
      // book meeting
      // setIsModalOpen(false);
      // setCalendlyOpen(true);
      toBuyPage();
      return;
    }
  };

  const isCircleIp = useMemo(() => {
    return (
      config.serverUrl === 'localhost' ||
      config.serverUrl.startsWith('192.168.') ||
      config.serverUrl === '127.0.0.1'
    );
  }, [config.serverUrl]);

  return (
    <div>
      <Modal
        title={''}
        closable
        footer={<></>}
        open={calendlyOpen}
        onCancel={() => setCalendlyOpen(false)}
        width={1000}
        height={720}
      >
        <Calendly></Calendly>
      </Modal>
      <Modal
        title={modelTitle}
        closable
        open={isModalOpen}
        onOk={onOk}
        okText={okText}
        cancelText={t('common.cancel')}
        onCancel={() => {
          setIsModalOpen(false);
        }}
      >
        {key === 'server' && (
          <>
            {isCircleIp ? (
              <>
                <div>{t('settings.license.circle_ip')}</div>
                <Input
                  style={{ color: '#888', marginTop: '8px' }}
                  disabled
                  type="text"
                  size="large"
                  value={ipAddress}
                  onChange={(e) => {
                    setIpAddress(e.target.value);
                  }}
                ></Input>
              </>
            ) : (
              <div>{t('settings.license.confirm_ip')}</div>
            )}
          </>
        )}
        {key === 'update' && (
          <TextArea
            rows={5}
            placeholder={t('settings.license.input')}
            value={licenseValue}
            onChange={(e) => {
              setLicenseValue(e.target.value);
            }}
          />
        )}
        {key === 'renew' && (
          <>
            <div style={{ marginBottom: '8px' }}>{t('settings.license.price_select')}</div>
            <Radio.Group
              size="large"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
              options={options}
              onChange={onChange}
              value={value}
              optionType="button"
            />
          </>
        )}
      </Modal>
      {items}
      <div className={styles.setting_box} style={{ gap: '8px', display: 'flex' }}>
        <Button
          type="primary"
          onClick={() => {
            setIsModalOpen(true);
            setKey('renew');
          }}
        >
          {t('settings.license.renew')}
        </Button>
        <Button
          type="default"
          onClick={() => {
            setIsModalOpen(true);
            setKey('update');
          }}
        >
          {t('settings.license.update')}
        </Button>
      </div>
      <div className={styles.gift_box}>
        <h2>{t('settings.license.gift.title')}</h2>
        <div>{t('settings.license.gift.desc')}</div>
        <img
          src="https://static.readdy.ai/image/736cb33f85ee328c22e5d7e17bec9c40/1e18fe5f59b60ead0da50d1d023aab98.png"
          style={{ width: '120px', margin: '8px 0' }}
        ></img>
      </div>
    </div>
  );
}

export const licenseStatusTag = (
  status: LicenseStatus,
): {
  color: PresetStatusColorType;
  text: string;
  icon: React.ReactNode;
} => {
  switch (status) {
    case LicenseStatus.Expired:
      return {
        color: 'error',
        text: 'Expired',
        icon: <CloseCircleOutlined />,
      };
    case LicenseStatus.Valid:
      return {
        color: 'success',
        text: 'Valid',
        icon: <CheckCircleOutlined />,
      };
    case LicenseStatus.Tmp:
      return {
        color: 'warning',
        text: 'Temporary',
        icon: <ExclamationCircleOutlined />,
      };
    default:
      return {
        color: 'error',
        text: 'Expired',
        icon: <CloseCircleOutlined />,
      };
  }
};
