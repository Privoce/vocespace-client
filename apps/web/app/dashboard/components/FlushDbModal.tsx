import React from 'react';
import { Modal, Input } from 'antd';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';

interface FlushDbModalProps {
  open: boolean;
  hostToken: string;
  onTokenChange: (token: string) => void;
  onCancel: () => void;
  onFlushSuccess: () => void;
  messageApi: any;
}

export const FlushDbModal: React.FC<FlushDbModalProps> = ({
  open,
  hostToken,
  onTokenChange,
  onCancel,
  onFlushSuccess,
  messageApi,
}) => {
  const { t } = useI18n();

  const handleFlush = async () => {
    try {
      const resp = await api.flushdb(hostToken);
      if (resp.ok) {
        messageApi.success(t('dashboard.conf.flushdb.success'));
        onFlushSuccess();
      } else {
        const { message } = await resp.json();
        messageApi.error(message);
      }
    } catch (e: any) {
      console.error(e);
      messageApi.error(e.message);
    } finally {
      onCancel();
      onTokenChange('');
    }
  };

  return (
    <Modal
      title={t('dashboard.conf.flushdb.title')}
      open={open}
      onCancel={onCancel}
      okText={t('dashboard.conf.flushdb.confirm')}
      cancelText={t('dashboard.conf.flushdb.cancel')}
      onOk={handleFlush}
    >
      <div>{t('dashboard.conf.flushdb.desc')}</div>
      <Input
        placeholder={t('dashboard.conf.placeholder')}
        value={hostToken}
        onChange={(e) => {
          onTokenChange(e.target.value);
        }}
      ></Input>
    </Modal>
  );
};
