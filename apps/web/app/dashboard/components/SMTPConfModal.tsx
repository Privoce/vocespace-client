import React from 'react';
import { Button, Input, InputNumber, Modal, Switch } from 'antd';
import { SMTPConf } from '@/lib/std/conf';
import { useI18n } from '@/lib/i18n/i18n';

interface SMTPConfModalProps {
  open: boolean;
  isHostManager: boolean;
  hostToken: string;
  smtpConf: SMTPConf;
  onTokenChange: (token: string) => void;
  onSMTPConfChange: (next: SMTPConf) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export const SMTPConfModal: React.FC<SMTPConfModalProps> = ({
  open,
  isHostManager,
  hostToken,
  smtpConf,
  onTokenChange,
  onSMTPConfChange,
  onCancel,
  onConfirm,
}) => {
  const { t } = useI18n();

  return (
    <Modal
      title={t('dashboard.conf.smtp.title')}
      open={open}
      onCancel={onCancel}
      footer={
        <Button type="primary" onClick={onConfirm}>
          {!isHostManager ? t('dashboard.conf.verify') : t('dashboard.save')}
        </Button>
      }
    >
      {isHostManager ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Input
            addonBefore={t('dashboard.conf.smtp.host')}
            value={smtpConf.host}
            onChange={(e) => {
              onSMTPConfChange({ ...smtpConf, host: e.target.value });
            }}
          ></Input>
          <InputNumber
            addonBefore={t('dashboard.conf.smtp.port')}
            style={{ width: '100%' }}
            value={smtpConf.port}
            min={1}
            max={65535}
            onChange={(value) => {
              onSMTPConfChange({ ...smtpConf, port: value || 587 });
            }}
          ></InputNumber>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{t('dashboard.conf.smtp.secure')}</span>
            <Switch
              checked={smtpConf.secure}
              onChange={(checked) => {
                onSMTPConfChange({ ...smtpConf, secure: checked });
              }}
            ></Switch>
          </div>
          <Input
            addonBefore={t('dashboard.conf.smtp.user')}
            value={smtpConf.user}
            onChange={(e) => {
              onSMTPConfChange({ ...smtpConf, user: e.target.value });
            }}
          ></Input>
          <Input.Password
            addonBefore={t('dashboard.conf.smtp.pass')}
            value={smtpConf.pass}
            onChange={(e) => {
              onSMTPConfChange({ ...smtpConf, pass: e.target.value });
            }}
          ></Input.Password>
          <Input
            addonBefore={t('dashboard.conf.smtp.from')}
            value={smtpConf.from}
            onChange={(e) => {
              onSMTPConfChange({ ...smtpConf, from: e.target.value });
            }}
          ></Input>
        </div>
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
