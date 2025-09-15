import { useI18n } from '@/lib/i18n/i18n';
import { PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Card, Row, Space, Statistic, StatisticTimerProps, TimePicker } from 'antd';
import { useMemo } from 'react';
import { MessageInstance } from 'antd/es/message/interface';
const { Timer } = Statistic;
import dayjs from 'dayjs';
import { src } from '@/lib/std';
import styles from '@/styles/apps.module.scss';
import { CardSize } from 'antd/es/card/Card';
import { AppAuth, Countdown } from '@/lib/std/space';

export interface CountdownProps {
  messageApi: MessageInstance;
  size?: CardSize;
  appData: Countdown;
  setAppData: (data: Countdown) => Promise<void>;
  auth: AppAuth;
}

export function AppCountdown({
  messageApi,
  size = 'default',
  appData,
  setAppData,
  auth,
}: CountdownProps) {
  const { t } = useI18n();
  const disabled = useMemo(() => {
    return auth !== 'write';
  }, [auth]);
  // 开始倒计时
  const startCountdown = async () => {
    if (!appData.duration) {
      messageApi.error(t('more.app.countdown.error.set'));
      return;
    }

    if (appData.stopTimeStamp && appData.stopTimeStamp > 0) {
      // 如果有停止时间戳，继续倒计时
      await setAppData({
        ...appData,
        running: true,
        stopTimeStamp: null,
      });
    } else {
      const hours = appData.duration.hour();
      const minutes = appData.duration.minute();
      const seconds = appData.duration.second();
      const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

      if (totalMs <= 0) {
        messageApi.error(t('more.app.countdown.error.valid'));
        return;
      }
      let start = Date.now();
      const endTime = start + totalMs;
      await setAppData({
        ...appData,
        value: endTime,
        running: true,
      });
    }
  };

  // 停止倒计时
  const stopCountdown = async () => {
    await setAppData({
      ...appData,
      running: false,
      stopTimeStamp: Date.now(),
    });
  };

  // 重置倒计时
  const resetCountdown = async () => {
    await setAppData({
      ...appData,
      running: false,
      value: null,
      duration: dayjs().hour(0).minute(5).second(0),
      stopTimeStamp: null,
    });
  };
  const onCountdownFinish: StatisticTimerProps['onFinish'] = async () => {
    await setAppData({
      ...appData,
      running: false,
      value: null,
      stopTimeStamp: null,
    });
    const audioSrc = src('/audios/alarm.mp3');
    const audio = new Audio(audioSrc);
    audio.volume = 1.0;
    audio.play().then(() => {
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.remove();
      }, 4000);
    });
  };

  const timestampToSecond = (timestamp: number) => {
    if (!timestamp) return '00:00:00';
    const seconds = Math.floor(timestamp / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      secs,
    ).padStart(2, '0')}`;
  };

  const timerStyle = useMemo(() => {
    if (size === 'default') {
      return {
        text: {
          fontSize: '48px',
          color: disabled ? '#666' : '#eee',
        },
        icon: {
          fontSize: '24px',
          color: disabled ? '#666' : '#8c8c8c',
        },
        icon_btn: {
          height: '44px',
          width: '44px',
          cursor: disabled ? 'not-allowed' : 'pointer',
        },
        start_btn: {
          height: '44px',
          width: '120px',
          cursor: disabled ? 'not-allowed' : 'pointer',
        },
      };
    } else {
      return {
        text: {
          fontSize: '24px',
          color: disabled ? '#666' : '#eee',
        },
        icon: {
          fontSize: '14px',
          color: disabled ? '#666' : '#8c8c8c',
        },
        icon_btn: {
          height: '20px',
          width: '20px',
          cursor: disabled ? 'not-allowed' : 'pointer',
        },
        start_btn: {
          height: '20px',
          width: '48px',
          cursor: disabled ? 'not-allowed' : 'pointer',
        },
      };
    }
  }, [size, disabled]);

  return (
    <Card style={{ width: '100%' }} size={size}>
      <Space
        direction="vertical"
        size={size === 'small' ? 'small' : 'large'}
        style={{ width: '100%' }}
      >
        <Row align="middle">
          <TimePicker
            value={appData.duration}
            onChange={async (value) => {
              let newValue = value;
              if (!value) {
                newValue = dayjs().hour(0).minute(5).second(0);
              }
              await setAppData({
                ...appData,
                duration: newValue,
              });
            }}
            showNow={false}
            format="HH:mm:ss"
            disabled={disabled || appData.running}
            placeholder={t('more.app.countdown.placeholder')}
            style={{ width: '100%', outline: '1px solid #22CCEE' }}
          />
        </Row>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          {appData.stopTimeStamp ? (
            <Statistic
              value={
                appData.value
                  ? timestampToSecond(appData.value - appData.stopTimeStamp)
                  : '--:--:--'
              }
              valueStyle={timerStyle.text}
            />
          ) : (
            <>
              {appData.value ? (
                <Timer
                  type="countdown"
                  value={appData.value}
                  onFinish={onCountdownFinish}
                  format="HH:mm:ss"
                  valueStyle={timerStyle.text}
                />
              ) : (
                <Statistic
                  value={appData.duration?.format('HH:mm:ss')}
                  valueStyle={timerStyle.text}
                />
              )}
            </>
          )}
        </div>

        <Row align="bottom" justify="center">
          <Space size={'large'}>
            {appData.running ? (
              <button
                disabled={disabled}
                className={styles.circle_btn}
                onClick={stopCountdown}
                style={timerStyle.icon_btn}
              >
                <PauseCircleOutlined style={timerStyle.icon} />
              </button>
            ) : appData.stopTimeStamp && appData.stopTimeStamp > 0 ? (
              <>
                <button
                  disabled={disabled}
                  onClick={resetCountdown}
                  className={styles.circle_btn}
                  style={timerStyle.icon_btn}
                >
                  <ReloadOutlined style={timerStyle.icon} />
                </button>
                <button
                  disabled={disabled}
                  className={styles.circle_btn}
                  style={timerStyle.icon_btn}
                  onClick={startCountdown}
                >
                  <PlayCircleOutlined style={timerStyle.icon} />
                </button>
              </>
            ) : (
              <button
                disabled={disabled}
                onClick={startCountdown}
                className={styles.start_btn}
                style={timerStyle.start_btn}
              >
                <PlayCircleOutlined style={timerStyle.icon} />
              </button>
            )}
          </Space>
        </Row>
      </Space>
    </Card>
  );
}
