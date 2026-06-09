import React from 'react';
import { Modal, Input, Button } from 'antd';
import { ConfQulity } from '@/app/pages/controls/settings/conf';
import { useI18n } from '@/lib/i18n/i18n';

interface GlobalConfModalProps {
  open: boolean;
  isHostManager: boolean;
  hostToken: string;
  onTokenChange: (token: string) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  onReload: () => void;
  messageApi: any;
}

export const GlobalConfModal: React.FC<GlobalConfModalProps> = ({
  open,
  isHostManager,
  hostToken,
  onTokenChange,
  onCancel,
  onConfirm,
  onReload,
  messageApi,
}) => {
  const { t } = useI18n();

  return (
    <Modal
      title={t('dashboard.conf.resolution')}
      open={open}
      onCancel={onCancel}
      footer={
        <Button type="primary" onClick={onConfirm}>
          {!isHostManager ? t('dashboard.conf.verify') : t('dashboard.conf.close')}
        </Button>
      }
    >
      {isHostManager ? (
        <ConfQulity
          space=""
          isOwner={isHostManager}
          messageApi={messageApi}
          onReload={onReload}
        ></ConfQulity>
      ) : (
        <Input
          placeholder={t('dashboard.conf.placeholder')}
          value={hostToken}
          onChange={(e) => {
            onTokenChange(e.target.value);
          }}
        ></Input>
      )}
    </Modal>
  );
};
