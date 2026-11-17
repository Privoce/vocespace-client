import { useState } from 'react';
import { Alert, Button, Input, InputNumber, Modal, Switch } from 'antd';
import { isValidAIConf, type AIConf } from '@/lib/std/conf';
import { useI18n } from '@/lib/i18n/i18n';

interface AIConfModalProps {
  open: boolean;
  isHostManager: boolean;
  hostToken: string;
  aiConf: AIConf;
  onTokenChange: (token: string) => void;
  onAIConfChange: (next: AIConf) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function AIConfModal({
  open,
  isHostManager,
  hostToken,
  aiConf,
  onTokenChange,
  onAIConfChange,
  onCancel,
  onConfirm,
}: AIConfModalProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={t('dashboard.conf.ai.title')}
      open={open}
      onCancel={onCancel}
      footer={
        <Button
          type="primary"
          loading={busy}
          disabled={isHostManager && !isValidAIConf(aiConf)}
          onClick={confirm}
        >
          {t(isHostManager ? 'dashboard.save' : 'dashboard.conf.verify')}
        </Button>
      }
    >
      {isHostManager ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isValidAIConf(aiConf) && (
            <Alert type="warning" message={t('dashboard.conf.ai.invalid')} />
          )}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {t('dashboard.conf.ai.enabled')}
            <Switch
              checked={aiConf.enabled}
              onChange={(enabled) => onAIConfChange({ ...aiConf, enabled })}
            />
          </label>
          <Input.Password
            addonBefore={t('dashboard.conf.ai.api_key')}
            autoComplete="off"
            value={aiConf.apiKey}
            onChange={(event) => onAIConfChange({ ...aiConf, apiKey: event.target.value })}
          />
          <Input
            addonBefore={t('dashboard.conf.ai.api_url')}
            value={aiConf.apiUrl}
            onChange={(event) => onAIConfChange({ ...aiConf, apiUrl: event.target.value })}
          />
          <Input
            addonBefore={t('dashboard.conf.ai.model')}
            value={aiConf.model}
            onChange={(event) => onAIConfChange({ ...aiConf, model: event.target.value })}
          />
          <InputNumber
            style={{ width: '100%' }}
            addonBefore={t('dashboard.conf.ai.max_tokens')}
            min={1}
            precision={0}
            value={aiConf.maxTokens}
            onChange={(value) => onAIConfChange({ ...aiConf, maxTokens: value ?? undefined })}
          />
        </div>
      ) : (
        <Input.Password
          placeholder={t('dashboard.conf.placeholder')}
          value={hostToken}
          onChange={(event) => onTokenChange(event.target.value)}
          onPressEnter={confirm}
        />
      )}
    </Modal>
  );
}
