import { licenseState } from '@/app/[roomName]/PageClientImpl';
import { useI18n } from '@/lib/i18n/i18n';
import styles from '@/styles/controls.module.scss';
import { Button, Input, Modal, Radio, RadioChangeEvent } from 'antd';
import { CheckboxGroupProps } from 'antd/es/checkbox';
import TextArea from 'antd/es/input/TextArea';
import { MessageInstance } from 'antd/es/message/interface';
import { useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';
import { Calendly } from '../calendly';
import { getServerIp } from '@/lib/std';

type ModelKey = 'update' | 'renew' | 'server';
type OptionValue = 'renew' | 'custom';
const IP = process.env.SERVER_NAME ?? getServerIp() ?? 'localhost';
export function LicenseControl({ messageApi }: { messageApi: MessageInstance }) {
  const { t } = useI18n();
  const [userLicense, setUserLicense] = useRecoilState(licenseState);
  const [ipAddress, setIpAddress] = useState(IP);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calendlyOpen, setCalendlyOpen] = useState(false);
  const [key, setKey] = useState<ModelKey>('renew');
  const [value, setValue] = useState<OptionValue>('renew');
  const [licenseValue, setLicenseValue] = useState<string>('');
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
      // 请求 在chat.vocespace.com/api/webhook?session_ip=IP, 让官方服务器通过stripe的api获取用户的session
      // 然后用户侧获取到session.url进行跳转
      const url = `https://chat.vocespace.com/api/webhook?session_ip=${IP}`;
      const response = await fetch(url, {
        method: 'GET',
      });
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
        key: t('settings.license.signed'),
        value: userLicense?.id ? 'Yes' : userLicense.ilimit == 'Free' ? 'Yes' : 'No',
      },
      {
        key: t('settings.license.domains'),
        value: userLicense.domains,
      },
      {
        key: t('settings.license.limit'),
        value: userLicense.ilimit,
      },
      {
        key: t('settings.license.created_at'),
        value: fmtDate(new Date(userLicense.created_at * 1000)),
      },
      {
        key: t('settings.license.expires_at'),
        value: fmtDate(new Date(userLicense.expires_at * 1000)),
      },
      {
        key: t('settings.license.value'),
        value: userLicense.value,
      },
    ];
    const now_timestamp = new Date().getTime();
    const valid = userLicense.value !== '' && userLicense.expires_at < now_timestamp;
    const validStyles = valid
      ? {}
      : {
          border: '2px solid #f00',
          backgroundColor: '#fdd',
        };

    const validTextStyles = valid
      ? {}
      : {
          color: '#f00',
        };

    return (
      <div className={styles.license_wrapper} style={validStyles}>
        {items.map((item, index) => (
          <div key={index} style={{ width: '100%' }}>
            <div className={styles.license_wrapper_title} style={validTextStyles}>
              {item.key}
            </div>
            <div className={styles.license_wrapper_content}>{item.value}</div>
          </div>
        ))}
      </div>
    );
  }, [userLicense]);

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
      // if update should store check from server and then store in local storage
      const url = `https://space.voce.chat/api/license/${licenseValue}`;
      const response = await fetch(url, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.warn('license data', data);
        if (data.code && data.code != 200) {
          messageApi.error({
            content: t('settings.license.invalid'),
            duration: 2,
          });
        } else {
          // update license
          setUserLicense(data);
          // set into local storage
          window.localStorage.setItem('license', data.value);
          setIsModalOpen(false);
          setLicenseValue('');
          messageApi.success({
            content: t('settings.license.update_success'),
            duration: 2,
          });
        }
      } else {
        // can not get license, means license is not valid
        messageApi.error({
          content: t('settings.license.invalid'),
          duration: 2,
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
    return IP === 'localhost' || IP.startsWith('192.168.');
  }, [IP]);

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
      <div className={styles.setting_box}>
        <h3>{t('settings.license.title')}</h3>
      </div>
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
      </div>
    </div>
  );
}

enum Limit {
  No = 'No',
  Admin = 'Admin',
  Guest = 'Guest',
}
