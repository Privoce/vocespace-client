import { LicenseWithAnalysis } from '@/lib/store/license';
import { useLicenseStore, useRoomStore } from '@/lib/store';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { useI18n } from '@/lib/i18n/i18n';
import styles from '@/styles/controls.module.scss';
import { Button, Descriptions, Input, Modal, Tag } from 'antd';
import TextArea from 'antd/es/input/TextArea';
import { MessageInstance } from 'antd/es/message/interface';
import { useEffect, useMemo, useState } from 'react';
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
import { DEFAULT_VOCESPACE_CONFIG, ReadableConf } from '@/lib/std/conf';
import { WsBase } from '@/lib/std/device';

export function LicenseControl({
  messageApi,
  space,
}: {
  messageApi: MessageInstance;
  space: string;
}) {
  const { t } = useI18n();
  const userLicense = useLicenseStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calendlyOpen, setCalendlyOpen] = useState(false);
  const [licenseValue, setLicenseValue] = useState<string>('');
  const [config, setConfig] = useState(DEFAULT_VOCESPACE_CONFIG);
  const [ipAddress, setIpAddress] = useState<string | undefined>(undefined);

  const roomLicense = userLicense.room;

  const validRoomLicense = async () => {
    if (!roomLicense?.isAnalysis) {
      const response = await api.getConf();
      if (!response.ok) return;
      const confData: ReadableConf = await response.json();
      setConfig(confData);
      setIpAddress(confData.serverUrl);

      const roomLicenseEntry = confData.roomLicenses?.find((r) => r.name === space);
      if (roomLicenseEntry) {
        const license = analyzeLicense(roomLicenseEntry.license, (_e) => {
          messageApi.error({
            content: t('settings.license.invalid') + t('settings.license.default_license'),
            duration: 8,
          });
        });
        if (!validLicenseDomain(license.domains, confData.serverUrl)) {
          messageApi.error(t('settings.license.invalid_domain'));
          return;
        }

        useLicenseStore.setState({
          room: {
            ...license,
            isAnalysis: true,
            personLimit: getLicensePersonLimit(license.limit, license.isTmp),
          },
        });
      }
    }
  };

  useEffect(() => {
    if (!ipAddress) {
      validRoomLicense();
    }
  }, [ipAddress]);

  const toBuyPage = async () => {
    if (isCircleIp) {
      window.open('https://buy.stripe.com/fZu3cveyR76afv6bPi6c01m', '_blank');
    } else {
      // 请求 在space.voce.chat/api/webhook?session_ip=IP&license_type=room, 让官方服务器通过stripe的api获取用户的session
      // 然后用户侧获取到session.url进行跳转
      const response = await api.getLicenseByIP(config.serverUrl, 'room');
      if (response.ok) {
        const { url } = await response.json();
        if (url) {
          window.open(url, '_blank');
        }
      } else {
        messageApi.warning({
          content: 'Failed to get session url',
          duration: 2,
        });
        window.open('https://buy.stripe.com/fZu3cveyR76afv6bPi6c01m', '_blank');
      }
    }
  };

  const fmtDate = (date: Date): string => {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const status = useMemo(() => {
    if (!roomLicense) return LicenseStatus.Expired;
    return licenseStatus(roomLicense);
  }, [roomLicense]);

  const items = useMemo(() => {
    let descriptionItems = [
      {
        key: 1,
        label: t('settings.license.signed'),
        children: roomLicense?.isAnalysis ? 'Yes' : 'No',
      },
      {
        key: 2,
        label: t('settings.license.domains'),
        children: roomLicense?.domains || '-',
      },
      {
        key: 3,
        label: t('settings.license.limit'),
        children: roomLicense?.limit || '-',
      },
      {
        key: 4,
        label: t('settings.license.person'),
        children: roomLicense ? getLicensePersonLimit(roomLicense.limit, roomLicense.isTmp).toString() : '-',
      },
      {
        key: 5,
        label: t('settings.license.created_at'),
        children: roomLicense?.created_at ? fmtDate(new Date(roomLicense.created_at * 1000)) : '-',
      },
      {
        key: 6,
        label: t('settings.license.expires_at'),
        children: roomLicense?.expires_at ? fmtDate(new Date(roomLicense.expires_at * 1000)) : '-',
      },
      {
        key: 7,
        label: t('settings.license.value'),
        children: roomLicense?.value || '-',
      },
    ];
    const { color, text: statusText, icon: statusIcon } = licenseStatusTag(status);
    return (
      <Descriptions
        styles={{label: {color: "#8f8f8f", whiteSpace: "nowrap"},  root: {width: "100%"}}}
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
        items={descriptionItems}
      />
    );
  }, [roomLicense, t, status]);

  const onUpdate = async () => {
    if (!licenseValue || licenseValue.trim() === '') {
      messageApi.error({
        content: t('settings.license.invalid'),
        duration: 3,
      });
      return;
    }

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

    // 将房间证书写入配置文件
    const response = await api.reloadRoomLicense(licenseValue, space);
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        useLicenseStore.setState({
          room: {
            ...validatedLicense,
            isAnalysis: true,
            personLimit: getLicensePersonLimit(validatedLicense.limit, validatedLicense.isTmp),
          } as LicenseWithAnalysis,
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
        messageApi.error({
          content: data.error || t('settings.license.invalid'),
          duration: 4,
        });
      }
    } else {
      const { error } = await response.json();
      messageApi.error({
        content: error || t('settings.license.invalid'),
        duration: 4,
      });
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
        title={t('settings.license.update')}
        closable
        open={isModalOpen}
        onOk={onUpdate}
        okText={t('settings.license.update')}
        cancelText={t('common.cancel')}
        onCancel={() => {
          setIsModalOpen(false);
        }}
      >
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
          <TextArea
            rows={5}
            placeholder={t('settings.license.input')}
            value={licenseValue}
            onChange={(e) => {
              setLicenseValue(e.target.value);
            }}
          />
        )}
      </Modal>
      {roomLicense ? (
        items
      ) : (
        <div style={{ padding: '24px 0', color: '#888' }}>
          {t('settings.license.no_room_license')}
        </div>
      )}
      <div className={styles.setting_box} style={{ gap: '8px', display: 'flex' }}>
        <Button
          type="primary"
          onClick={toBuyPage}
        >
          {t('settings.license.buy')}
        </Button>
        <Button
          type="default"
          onClick={() => {
            setIsModalOpen(true);
          }}
        >
          {t('settings.license.update')}
        </Button>
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
