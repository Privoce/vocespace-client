import styles from '@/styles/controls.module.scss';
import { Radio, Slider } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';
import { AudioSelect } from '../selects/audio_select';
import { LocalParticipant, Track } from 'livekit-client';
import { useEffect } from 'react';

export interface AudioSettingsProps {
  volume: number;
  setVolume: (value: number) => void;
  noiseSuppression: boolean;
  setNoiseSuppression: (value: boolean) => void;
  echoCancellation: boolean;
  setEchoCancellation: (value: boolean) => void;
  autoGainControl: boolean;
  setAutoGainControl: (value: boolean) => void;
  localParticipant?: LocalParticipant;
}

export function AudioSettings({
  volume,
  setVolume,
  noiseSuppression,
  setNoiseSuppression,
  echoCancellation,
  setEchoCancellation,
  autoGainControl,
  setAutoGainControl,
  localParticipant,
}: AudioSettingsProps) {
  const { t } = useI18n();

  // 当音频处理设置变化时，应用到本地音频轨道
  useEffect(() => {
    if (!localParticipant) return;

    const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
    const micTrack = micPublication?.track?.mediaStreamTrack;
    if (!micTrack) return;

    micTrack
      .applyConstraints({
        noiseSuppression,
        echoCancellation,
        autoGainControl,
      })
      .catch((err) => {
        console.warn('Failed to apply audio constraints:', err);
      });
  }, [noiseSuppression, echoCancellation, autoGainControl, localParticipant]);

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
      <div className={styles.setting_box}>
        <div>{t('settings.audio.noise_suppression')}:</div>
        <Radio.Group
          size="large"
          block
          className={styles.common_space}
          value={noiseSuppression}
          onChange={(e) => setNoiseSuppression(e.target.value)}
        >
          <Radio.Button value={true}>{t('common.open')}</Radio.Button>
          <Radio.Button value={false}>{t('common.close')}</Radio.Button>
        </Radio.Group>
      </div>
      <div className={styles.setting_box}>
        <div>{t('settings.audio.echo_cancellation')}:</div>
        <Radio.Group
        size="large"
          block
          className={styles.common_space}
          value={echoCancellation}
          onChange={(e) => setEchoCancellation(e.target.value)}
        >
          <Radio.Button value={true}>{t('common.open')}</Radio.Button>
          <Radio.Button value={false}>{t('common.close')}</Radio.Button>
        </Radio.Group>
      </div>
      <div className={styles.setting_box}>
        <div>{t('settings.audio.auto_gain_control')}:</div>
        <Radio.Group
          size="large"
          block
          className={styles.common_space}
          value={autoGainControl}
          onChange={(e) => setAutoGainControl(e.target.value)}
        >
          <Radio.Button value={true}>{t('common.open')}</Radio.Button>
          <Radio.Button value={false}>{t('common.close')}</Radio.Button>
        </Radio.Group>
      </div>
    </div>
  );
}
