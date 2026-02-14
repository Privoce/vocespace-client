'use client';

import { Result } from 'antd';
import { Button } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';

const CustomError = () => {
  const { t } = useI18n();

  const backToNewSpace = () => {
    window.location.href = '/new_space';
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
      }}
    >
      <Result
        status="error"
        title={t('msg.error.client.title')}
        subTitle={
          <>
            <p style={{ color: '#fff', fontSize: 16 }}>{t('msg.error.client.sub')}</p>
            <span style={{ color: '#fff', fontSize: 16 }}>{t('msg.error.client.connect')}</span>
          </>
        }
        extra={[
          <Button type="primary" onClick={backToNewSpace}>
            {t('msg.error.client.back')}
          </Button>,
        ]}
      ></Result>
    </div>
  );
};

export default CustomError;
