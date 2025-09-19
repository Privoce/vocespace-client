import { Button, InputNumber, Select, Slider, SliderSingleProps } from 'antd';
import styles from '@/styles/controls.module.scss';
import { useI18n } from '@/lib/i18n/i18n';
import { useEffect, useRef, useState } from 'react';
import {
  countLevelByConf,
  RTCConf,
  rtcLevelToNumber,
  rtcNumberToConf,
  VocespaceConfig,
} from '@/lib/std/conf';
import { api } from '@/lib/api';
import { isUndefinedNumber, isUndefinedString } from '@/lib/std';
import { MessageInstance } from 'antd/es/message/interface';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import equal from 'fast-deep-equal';

export interface ConfQulityProps {
  isOwner: boolean;
  messageApi: MessageInstance;
  space: string;
  onReload?: () => void;
}

export function ConfQulity({ isOwner, messageApi, space, onReload }: ConfQulityProps) {
  const { t } = useI18n();
  const { rtcConf, getRTCConf, setRTCConf } = useRTCConf({
    onSuccess: (data) => {
      setMaxBitrate(data.maxBitrate);
      setMaxFramerate(data.maxFramerate);
      originConf.current = data;
      let rtcLevel = rtcLevelToNumber(countLevelByConf(data));
      setRtcLevel(rtcLevel);
      originRtcLevel.current = rtcLevel;
    },
    onError: (_) => {
      messageApi.error(t('settings.general.conf.load_error'));
    },
  });
  const [maxBitrate, setMaxBitrate] = useState<number>(rtcConf?.maxBitrate || 0);
  const [maxFramerate, setMaxFramerate] = useState<number>(rtcConf?.maxFramerate || 0);
  const [define, setDefine] = useState(false);
  const [update, setUpdate] = useState(true);
  const originConf = useRef<RTCConf | null>(null);
  const [rtcLevel, setRtcLevel] = useState(50);
  const originRtcLevel = useRef(rtcLevel);
  const [reload, setReload] = useState(false);
  const unifiedSliderText = (label: string) => ({
    style: {
      color: '#fff',
    },
    label: <span>{label}</span>,
  });

  const marks: SliderSingleProps['marks'] = {
    0: unifiedSliderText(t('settings.general.conf.quality.smooth')),
    25: unifiedSliderText(t('settings.general.conf.quality.standard')),
    50: unifiedSliderText(t('settings.general.conf.quality.high')),
    75: unifiedSliderText(t('settings.general.conf.quality.hd')),
    100: unifiedSliderText(t('settings.general.conf.quality.ultra')),
  };

  // 同步 conf 变化到 maxBitrate 和 maxFramerate state
  useEffect(() => {
    if (update) {
      getRTCConf();
    }
  }, [update]);

  useEffect(() => {
    if (equal(rtcConf, originConf.current)) {
      setReload(false);
    } else {
      setReload(true);
    }
  }, [rtcConf, originConf]);

  const resolutionOptions = [
    { label: '540p', value: '540p' },
    { label: '720p', value: '720p' },
    { label: '1080p', value: '1080p' },
    { label: '2k', value: '2k' },
    { label: '4K', value: '4K' },
  ];

  const codecOptions = [
    { label: 'VP9', value: 'vp9' },
    { label: 'VP8', value: 'vp8' },
    { label: 'H264', value: 'h264' },
    { label: 'AV1', value: 'av1' },
  ];

  const reloadConf = async () => {
    if (rtcConf) {
      let reloadConf = rtcConf;
      if (!define) {
        // 用户没有自定义，而是使用了滑动条来快速设置
        reloadConf = rtcNumberToConf(rtcLevel);
      }

      const response = await api.reloadConf(reloadConf);
      if (response.ok) {
        setUpdate(true);
        // socket 通知所有其他设备需要重新加载(包括自己)
        socket.emit('reload_env', {
          space,
        } as WsBase);
        onReload && onReload();
      } else {
        const { error } = await response.json();
        messageApi.error(`${t('settings.general.conf.reload_env_error')}: ${error}`);
      }
    }
  };

  return (
    <>
      {isOwner && rtcConf ? (
        <>
          <div className={styles.common_space}>{t('settings.general.conf.quality.title')}:</div>
          <div className={styles.setting_box_line}>
            <Slider
              marks={marks}
              step={25}
              min={0}
              max={100}
              value={rtcLevel}
              dots
              range={false}
              style={{ width: '100%', marginLeft: '16px', marginRight: '16px' }}
              onChange={(value) => {
                setRtcLevel(value);
                setReload(value !== originRtcLevel.current);
              }}
            />
            <Button
              onClick={() => setDefine(!define)}
              className={styles.common_space}
              type="primary"
            >
              {t('settings.general.conf.quality.define')}
            </Button>
          </div>
          {define && (
            <>
              <div className={styles.common_space}>{t('settings.general.conf.codec')}:</div>
              <Select
                size="large"
                options={codecOptions}
                style={{ width: '100%' }}
                value={rtcConf.codec}
                onChange={(value) => {
                  setRTCConf({ ...rtcConf, codec: value });
                }}
              ></Select>
              <div className={styles.common_space}>{t('settings.general.conf.resolution')}:</div>
              <Select
                size="large"
                options={resolutionOptions}
                style={{ width: '100%' }}
                value={rtcConf.resolution}
                onChange={(value) => {
                  setRTCConf({ ...rtcConf, resolution: value });
                }}
              ></Select>
              <div className={styles.common_space}>{t('settings.general.conf.maxBitrate')}:</div>
              <InputNumber
                style={{ width: '100%' }}
                size="large"
                className={styles.common_space}
                value={maxBitrate}
                min={100000}
                keyboard={false}
                step={100000}
                max={20000000}
                formatter={(value) => `${value} bps`}
                onChange={(value) => {
                  setMaxBitrate(value ?? 100000);
                  setRTCConf({ ...rtcConf, maxBitrate: value ?? 100000 });
                }}
              ></InputNumber>
              <div className={styles.common_space}>{t('settings.general.conf.maxFramerate')}:</div>
              <InputNumber
                style={{ width: '100%' }}
                size="large"
                min={10}
                max={90}
                step={1}
                formatter={(value) => `${value} fps`}
                className={styles.common_space}
                value={maxFramerate}
                onChange={(value) => {
                  setMaxFramerate(value ?? 10);
                  setRTCConf({ ...rtcConf, maxFramerate: value ?? 10 });
                }}
              ></InputNumber>
            </>
          )}
          {reload && (
            <Button
              type="primary"
              block
              onClick={reloadConf}
              className={styles.common_space}
              size="large"
            >
              {t('settings.general.conf.reload')}
            </Button>
          )}
        </>
      ) : (
        <span></span>
      )}
    </>
  );
}

export function useVoceSpaceConf() {
  const [conf, setConf] = useState<VocespaceConfig | null>(null);
  const getConf = async () => {
    const response = await api.getConf();
    if (response.ok) {
      setConf((await response.json()) as VocespaceConfig);
    }
  };
  return { conf, getConf, setConf };
}

export interface UseRTCConfProps {
  onError?: (error: Error) => void;
  onSuccess?: (conf: RTCConf) => void;
}

export function useRTCConf({ onError, onSuccess }: UseRTCConfProps) {
  const [rtcConf, setRTCConf] = useState<RTCConf | null>(null);

  const getRTCConf = async () => {
    const response = await api.getConf();
    if (response.ok) {
      const { resolution, maxBitrate, maxFramerate, priority, codec }: VocespaceConfig =
        await response.json();
      if (
        isUndefinedString(resolution) ||
        isUndefinedNumber(maxBitrate) ||
        isUndefinedNumber(maxFramerate) ||
        isUndefinedString(priority) ||
        isUndefinedString(codec)
      ) {
        onError && onError(new Error('config data is undefined or empty, config error'));
      } else {
        const data = {
          codec: codec!,
          resolution: resolution!,
          maxBitrate: maxBitrate!,
          maxFramerate: maxFramerate!,
          priority: priority!,
        } as RTCConf;
        setRTCConf(data);
        onSuccess && onSuccess(data);
      }
    }
  };

  return {
    rtcConf,
    setRTCConf,
    getRTCConf,
  };
}
