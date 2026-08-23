import React from 'react';
import { Button, Input, Modal } from 'antd';
import { HyperbeamConf } from '@/lib/std/conf';
import { useI18n } from '@/lib/i18n/i18n';

interface HyperbeamConfModalProps {
  open: boolean;
  isHostManager: boolean;
  hostToken: string;
  hyperbeamConf: HyperbeamConf;
  onTokenChange: (token: string) => void;
  onHyperbeamConfChange: (next: HyperbeamConf) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export const HyperbeamConfModal: React.FC<HyperbeamConfModalProps> = ({
  open,
  isHostManager,
  hostToken,
  hyperbeamConf,
  onTokenChange,
  onHyperbeamConfChange,
  onCancel,
  onConfirm,
}) => {
  const { t } = useI18n();

  return (
    <Modal
      title={t('dashboard.conf.hyperbeam.title')}
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
          <Input.Password
            addonBefore={t('dashboard.conf.hyperbeam.api_key')}
            value={hyperbeamConf.apiKey}
            onChange={(e) => {
              onHyperbeamConfChange({ ...hyperbeamConf, apiKey: e.target.value });
            }}
          ></Input.Password>
          <Input
            addonBefore={t('dashboard.conf.hyperbeam.api_base')}
            value={hyperbeamConf.apiBase}
            onChange={(e) => {
              onHyperbeamConfChange({ ...hyperbeamConf, apiBase: e.target.value });
            }}
          ></Input>
          <Input
            addonBefore={t('dashboard.conf.hyperbeam.default_start_url')}
            value={hyperbeamConf.defaultStartUrl}
            onChange={(e) => {
              onHyperbeamConfChange({
                ...hyperbeamConf,
                defaultStartUrl: e.target.value,
              });
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
