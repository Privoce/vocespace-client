import { useI18n } from '@/lib/i18n/i18n';
import { PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Card, Row, Space, Statistic, StatisticTimerProps, TimePicker } from 'antd';
import { useMemo, useState } from 'react';
import { MessageInstance } from 'antd/es/message/interface';
const { Timer } = Statistic;
import dayjs, { type Dayjs } from 'dayjs';
import { src } from '@/lib/std';
import styles from '@/styles/apps.module.scss';
import { CardSize } from 'antd/es/card/Card';
import { useRecoilState } from 'recoil';
import { AppsDataState } from '@/app/[roomName]/PageClientImpl';

export interface CountdownProps {
  messageApi: MessageInstance;
  size?: CardSize;
}

export function AppCountdown({ messageApi, size = 'default' }: CountdownProps) {
  const { t } = useI18n();
  const [appData, setAppData] = useRecoilState(AppsDataState);
  // const [countdownValue, setCountdownValue] = useState<number | null>(null);
  // const [countdownDuration, setCountdownDuration] = useState<Dayjs | null>(
  //   dayjs().hour(0).minute(5).second(0), // 默认5分钟
  // );
  // const [countdownRunning, setCountdownRunning] = useState(false);

  // const [stopTimeStamp, setStopTimeStamp] = useState<number | null>(null);

  // 开始倒计时
  const startCountdown = () => {
    if (!appData.countdown.duration) {
      messageApi.error(t('more.app.countdown.error.set'));
      return;
    }

    if (appData.countdown.stopTimeStamp && appData.countdown.stopTimeStamp > 0) {
      // 如果有停止时间戳，继续倒计时
      setAppData((prev) => ({
        ...prev,
        countdown: {
          ...prev.countdown,
          running: true,
          stopTimeStamp: null,
        },
      }));
    } else {
      const hours = appData.countdown.duration.hour();
      const minutes = appData.countdown.duration.minute();
      const seconds = appData.countdown.duration.second();
      const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

      if (totalMs <= 0) {
        messageApi.error(t('more.app.countdown.error.valid'));
        return;
      }
      let start = Date.now();
      const endTime = start + totalMs;
      setAppData((prev) => ({
        ...prev,
        countdown: {
          ...prev.countdown,
          value: endTime,
          running: true,
        },
      }));
    }
  };

  // 停止倒计时
  const stopCountdown = () => {
    setAppData((prev) => ({
      ...prev,
      countdown: {
        ...prev.countdown,
        running: false,
        stopTimeStamp: Date.now(),
      },
    }));
  };

  // 重置倒计时
  const resetCountdown = () => {
    setAppData((prev) => ({
      ...prev,
      countdown: {
        ...prev.countdown,
        running: false,
        value: null,
        duration: dayjs().hour(0).minute(5).second(0),
        stopTimeStamp: null,
      },
    }));
  };
  const onCountdownFinish: StatisticTimerProps['onFinish'] = () => {
    setAppData((prev) => ({
      ...prev,
      countdown: {
        ...prev.countdown,
        running: false,
        value: null,
        stopTimeStamp: null,
      },
    }));
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
          color: '#eee',
        },
        icon: {
          fontSize: '24px',
        },
        icon_btn: {
          height: '44px',
          width: '44px',
        },
        start_btn: {
          height: '44px',
          width: '120px',
        },
      };
    } else {
      return {
        text: {
          fontSize: '24px',
          color: '#eee',
        },
        icon: {
          fontSize: '14px',
        },
        icon_btn: {
          height: '20px',
          width: '20px',
        },
        start_btn: {
          height: '20px',
          width: '48px',
        },
      };
    }
  }, [size]);

  return (
    <Card style={{ width: '100%' }} size={size}>
      <Space
        direction="vertical"
        size={size === 'small' ? 'small' : 'large'}
        style={{ width: '100%' }}
      >
        <Row align="middle">
          <TimePicker
            value={appData.countdown.duration}
            onChange={(value) => {
              setAppData((prev) => ({
                ...prev,
                countdown: {
                  ...prev.countdown,
                  duration: value,
                },
              }));
            }}
            showNow={false}
            format="HH:mm:ss"
            disabled={appData.countdown.running}
            placeholder={t('more.app.countdown.placeholder')}
            style={{ width: '100%', outline: '1px solid #22CCEE' }}
          />
        </Row>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          {appData.countdown.stopTimeStamp ? (
            <Statistic
              value={
                appData.countdown.value
                  ? timestampToSecond(appData.countdown.value - appData.countdown.stopTimeStamp)
                  : '--:--:--'
              }
              valueStyle={timerStyle.text}
            />
          ) : (
            <>
              {appData.countdown.value ? (
                <Timer
                  type="countdown"
                  value={appData.countdown.value}
                  onFinish={onCountdownFinish}
                  format="HH:mm:ss"
                  valueStyle={timerStyle.text}
                />
              ) : (
                <Statistic
                  value={appData.countdown.duration?.format('HH:mm:ss')}
                  valueStyle={timerStyle.text}
                />
              )}
            </>
          )}
        </div>

        <Row align="bottom" justify="center">
          <Space size={'large'}>
            {appData.countdown.running ? (
              <button
                className={styles.circle_btn}
                onClick={stopCountdown}
                style={timerStyle.icon_btn}
              >
                <PauseCircleOutlined style={timerStyle.icon} />
              </button>
            ) : appData.countdown.stopTimeStamp && appData.countdown.stopTimeStamp > 0 ? (
              <>
                <button
                  onClick={resetCountdown}
                  className={styles.circle_btn}
                  style={timerStyle.icon_btn}
                >
                  <ReloadOutlined style={timerStyle.icon} />
                </button>
                <button
                  className={styles.circle_btn}
                  style={timerStyle.icon_btn}
                  onClick={startCountdown}
                >
                  <PlayCircleOutlined style={timerStyle.icon} />
                </button>
              </>
            ) : (
              <button
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
