import {
  FieldTimeOutlined,
  FlagOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Space, Statistic } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TimeRecords } from './time_records';
import styles from '@/styles/apps.module.scss';
import { CardSize } from 'antd/es/card/Card';
import { useRecoilState } from 'recoil';
import { AppsDataState } from '@/app/[roomName]/PageClientImpl';
const { Timer } = Statistic;

export interface AppTimerProps {
  size?: CardSize;
}

export function AppTimer({ size = 'default' }: AppTimerProps) {
  // 计时相关状态
  const [appData, setAppData] = useRecoilState(AppsDataState);

  // 开始计时
  const startCountup = () => {
    if (appData.timer.value === null) {
      const startTime = Date.now();
      setAppData((prev) => ({
        ...prev,
        timer: {
          ...prev.timer,
          value: startTime,
          running: true,
        },
      }));
    } else {
      // 继续计时
      setAppData((prev) => ({
        ...prev,
        timer: {
          ...prev.timer,
          value: prev.timer.value! + Date.now() - prev.timer.stopTimeStamp!,
          running: true,
        },
      }));
    }
  };

  // 停止计时
  const stopCountup = () => {
    setAppData((prev) => ({
      ...prev,
      timer: {
        ...prev.timer,
        running: false,
        stopTimeStamp: Date.now(),
      },
    }));
  };

  // 重置计时
  const resetCountup = () => {
    setAppData((prev) => ({
      ...prev,
      timer: {
        ...prev.timer,
        running: false,
        value: null,
        stopTimeStamp: null,
        records: [],
      },
    }));
  };

  // 记录计时
  const recordCountup = () => {
    setAppData((prev) => {
      if (prev.timer.records.length >= 5) {
        return {
          ...prev,
          timer: {
            ...prev.timer,
            records: [...prev.timer.records.slice(1), timestampToSecond()],
          },
        };
      } else {
        return {
          ...prev,
          timer: {
            ...prev.timer,
            records: [...prev.timer.records, timestampToSecond()],
          },
        };
      }
    });
  };

  const timestampToSecond = () => {
    if (appData.timer.value === null) return '00:00:00';

    const currentTime = appData.timer.running ? Date.now() : appData.timer.stopTimeStamp!;
    const elapsedTime = currentTime - appData.timer.value;
    let seconds = Math.floor(elapsedTime / 1000);
    // 处理seconds，保证不为负数，同时format为: HH:mm:ss
    if (seconds < 0) {
      seconds = 0;
    }

    if (seconds === 0) {
      return '00:00:00';
    }

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
    <>
      <Card style={{ width: '100%' }} size={size}>
        <Space
          direction="vertical"
          size={size === 'small' ? 'small' : 'large'}
          style={{ width: '100%' }}
        >
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            {appData.timer.running ? (
              <>
                {appData.timer.value && (
                  <Timer
                    type="countup"
                    value={appData.timer.value}
                    format="HH:mm:ss"
                    valueStyle={timerStyle.text}
                  />
                )}
              </>
            ) : (
              <Statistic value={timestampToSecond()} valueStyle={timerStyle.text} />
            )}
          </div>
          <TimeRecords
            size={size}
            data={appData.timer.records}
            clear={() => {
              setAppData((prev) => ({
                ...prev,
                timer: {
                  ...prev.timer,
                  records: [],
                },
              }));
            }}
          ></TimeRecords>
          <Row justify="center">
            <Col>
              <Space size="large"></Space>
              {appData.timer.running ? (
                <Space size="large">
                  <button
                    className={styles.circle_btn}
                    onClick={recordCountup}
                    style={timerStyle.icon_btn}
                  >
                    <FlagOutlined style={timerStyle.icon} />
                  </button>
                  <button
                    className={styles.circle_btn}
                    onClick={stopCountup}
                    style={timerStyle.icon_btn}
                  >
                    <PauseCircleOutlined style={timerStyle.icon} />
                  </button>
                </Space>
              ) : (
                <Space size={'large'}>
                  {appData.timer.value === null ? (
                    <button
                      onClick={startCountup}
                      className={styles.start_btn}
                      style={timerStyle.start_btn}
                    >
                      <PlayCircleOutlined style={timerStyle.icon} />
                    </button>
                  ) : (
                    <>
                      <button
                        className={styles.circle_btn}
                        onClick={resetCountup}
                        style={timerStyle.icon_btn}
                      >
                        <ReloadOutlined style={timerStyle.icon} />
                      </button>
                      <button
                        className={styles.circle_btn}
                        onClick={startCountup}
                        style={timerStyle.icon_btn}
                      >
                        <PlayCircleOutlined style={timerStyle.icon} />
                      </button>
                    </>
                  )}
                </Space>
              )}
            </Col>
          </Row>
        </Space>
      </Card>
    </>
  );
}
