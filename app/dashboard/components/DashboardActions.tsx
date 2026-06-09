import React from 'react';
import { Card, Button, Select } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';

type ActionKey = 'refresh' | 'global_conf' | 'manage_spaces' | 'ac_space' | 'flushdb';

interface DashboardActionsProps {
  selectOption: ActionKey;
  loading: boolean;
  onOptionChange: (value: ActionKey) => void;
  onProceed: () => Promise<void>;
}

export const DashboardActions: React.FC<DashboardActionsProps> = ({
  selectOption,
  loading,
  onOptionChange,
  onProceed,
}) => {
  const { t } = useI18n();

  return (
    <Card style={{height: "100%"}}>
      <div style={{ marginBottom: '9px' }}>{t('dashboard.count.opt')}</div>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <Select
          value={selectOption}
          style={{ flex: 1 }}
          onChange={(v) => {
            onOptionChange(v as ActionKey);
          }}
          options={[
            {
              label: t('dashboard.count.refresh'),
              key: 'refresh',
              loading: loading,
              value: 'refresh',
            },
            {
              label: t('dashboard.count.global_conf'),
              key: 'global_conf',
              value: 'global_conf',
            },
            {
              label: t('dashboard.manage_spaces'),
              key: 'manage_spaces',
              value: 'manage_spaces',
            },
            {
              label: t('dashboard.count.allow_create_space'),
              key: 'ac_space',
              value: 'ac_space',
            },
            {
              label: (
                <span style={{ color: 'red' }}>{t('dashboard.conf.flushdb.title')}</span>
              ),
              value: 'flushdb',
              key: 'flushdb',
            },
          ]}
        ></Select>
        <Button type="primary" loading={loading} onClick={onProceed}>
          {t('dashboard.proceed')}
        </Button>
      </div>
    </Card>
  );
};
