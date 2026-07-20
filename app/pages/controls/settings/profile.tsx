'use client';

import { Input } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';
import { AvoConfigPanel } from '../../participant/avo_conf';
import type { ParticipantAvoParams } from '@/lib/std/space';
import styles from '@/styles/controls.module.scss';

export interface ProfileSettingsProps {
  username: string;
  setUsername: (username: string) => void;
  avoList?: ParticipantAvoParams[];
  saving?: boolean;
  onSave: (params: ParticipantAvoParams[]) => void | Promise<void>;
}

export const ProfileSettings = ({
  username,
  setUsername,
  avoList,
  saving,
  onSave,
}: ProfileSettingsProps) => {
  const { t } = useI18n();

  return (
    <div>
      <div className={styles.setting_box}>
        <div>{t('settings.general.username')}:</div>
        <Input
          size="large"
          className={styles.common_space}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
          }}
        />
      </div>
      <AvoConfigPanel
        direction="vertical"
        name={username}
        avoList={avoList}
        saving={saving}
        onSave={onSave}
      />
    </div>
  );
};
