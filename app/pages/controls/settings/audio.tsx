import styles from '@/styles/controls.module.scss';
import { Slider } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';
import { AudioSelect } from '../audio_select';

export interface AudioSettingsProps {
  volume: number;
  setVolume: (value: number) => void;
}

export function AudioSettings({ volume, setVolume }: AudioSettingsProps) {
  const { t } = useI18n();

  return (
    <div>
      <div className={styles.setting_box}>
        <div>{t('settings.audio.device')}:</div>
        <AudioSelect className={styles.common_space}></AudioSelect>
      </div>
      <div className={styles.setting_box}>
        <div>{t('settings.audio.volume')}:</div>
        <Slider
          value={volume}
          className={styles.common_space}
          min={0.0}
          max={100.0}
          step={1.0}
          onChange={(e) => {
            setVolume(e);
          }}
        />
      </div>
    </div>
  );
}
