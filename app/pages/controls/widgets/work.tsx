import { useI18n } from '@/lib/i18n/i18n';
import { ViewAdjusts } from '@/lib/std/window';
import { LaptopOutlined } from '@ant-design/icons';
import { Button, Modal, Slider } from 'antd';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { WsBase } from '@/lib/std/device';
import styles from '@/styles/controls.module.scss';
import { LocalParticipant, Room } from 'livekit-client';
import { api } from '@/lib/api';
import { MessageInstance } from 'antd/es/message/interface';
import equal from 'fast-deep-equal';
import { isSpaceManager } from '@/lib/std';
import { socket } from '@/app/[spaceName]/PageClientImpl';

export interface UseWorkProps {
  spaceInfo: SpaceInfo;
  space?: Room;
  messageApi: MessageInstance;
}

export const useWork = ({
  spaceInfo,
  space,
  messageApi,
}: UseWorkProps) => {
  const { t } = useI18n();
  const [openModal, setOpenModal] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [videoBlur, setVideoBlur] = useState(0.0);
  const [screenBlur, setScreenBlur] = useState(0.0);
  // 数据初始化和同步
  useEffect(() => {
    if (space) {
      const { videoBlur, screenBlur } = spaceInfo.work;
      const isEnabled =
        spaceInfo.participants[space.localParticipant.identity]?.work.enabled || false;
      setEnabled(isEnabled);
      setVideoBlur(videoBlur);
      setScreenBlur(screenBlur);
    }
  }, [space, spaceInfo]);

  const startOrStopWork = async (enabled: boolean) => {
    if (!space) return;
    const startWorkRes = await api.handleWorkMode(
      space.name,
      space.localParticipant.identity,
      enabled,
    );
    if (!startWorkRes.ok) {
      messageApi.error(t('work.mode.start.error'));
      return;
    } else {
      const { workType }: { workType: boolean } = await startWorkRes.json();

      // 成功开启/关闭了工作模式
      if (workType) {
        // 开启屏幕共享
        if (!space.localParticipant.isScreenShareEnabled) {
          space?.localParticipant.setScreenShareEnabled(true);
        }
        messageApi.success(t('work.mode.start.success'));
      } else {
        // 关闭屏幕共享
        space.localParticipant.setScreenShareEnabled(false);
        messageApi.success(t('work.mode.stop.success'));
      }
    }

    // socket通知更新用户状态
    socket.emit('update_user_status', {
      space: space.name,
    } as WsBase);
  };

  const handleWorkMode = useCallback(
    async (startWork?: boolean) => {
      if (!space) return;
      let enabledWork = startWork === undefined ? enabled : startWork;

      const work = {
        enabled: enabledWork,
        useAI: false,
        sync: false,
        videoBlur,
        screenBlur,
      };

      // 检查是否有更改
      if (!equal(spaceInfo.work, work)) {
        const response = await api.updateSpaceInfo(space.name, {
          work,
        });

        if (!response.ok) {
          messageApi.error(t('work.save.error'));
          return;
        }
        messageApi.success(t('work.save.success'));
      }

      // 处理工作模式的开启和关闭
      await startOrStopWork(enabledWork);
    },
    [
      enabled,
      videoBlur,
      screenBlur,
      space,
      spaceInfo,
      messageApi,
      t,
      startOrStopWork,
    ],
  );

  return {
    openModal,
    setOpenModal,
    enabled,
    setEnabled,
    videoBlur,
    setVideoBlur,
    screenBlur,
    setScreenBlur,
    handleWorkMode,
    startOrStopWork,
  };
};

export interface WorkProps {
  showText?: boolean;
  size: SizeType;
  controlWidth: number;
  spaceInfo: SpaceInfo;
  space: string;
  setOpenModal: (open: boolean) => void;
  isStartWork: boolean;
  setIsStartWork: (isStartWork: boolean) => void;
  startOrStopWork: (enabled: boolean) => Promise<void>;
  localParticipant: LocalParticipant;
}

export function Work({
  showText = true,
  controlWidth,
  spaceInfo,
  startOrStopWork,
  setOpenModal,
  isStartWork,
  localParticipant,
}: WorkProps) {
  if (!spaceInfo.ai.cut.enabled) {
    return <></>;
  }

  const { t } = useI18n();
  const showTextOrHide = useMemo(() => {
    return ViewAdjusts(controlWidth).w960 ? false : showText;
  }, [controlWidth]);

  return (
    <Button
      size="large"
      style={{
        backgroundColor: isStartWork ? '#22CCEE' : '#1E1E1E',
        height: '46px',
        borderRadius: '8px',
        border: 'none',
        color: '#fff',
        minWidth: '50px',
        width: 'fit-content',
      }}
      icon={<LaptopOutlined />}
      onClick={async () => {
        if (isStartWork) {
          // 关闭工作模式
          await startOrStopWork(false);
        } else {
          // 打开工作模式设置弹窗
          setOpenModal(true);
        }
      }}
    >
      {showTextOrHide ? (isStartWork ? t('work.close') : t('work.start')) : ''}
    </Button>
  );
}

export interface WorkModalProps {
  space?: Room;
  open: boolean;
  setOpen: (open: boolean) => void;
  isStartWork: boolean;
  setIsStartWork: (isStartWork: boolean) => void;
  videoBlur: number;
  setVideoBlur: (value: number) => void;
  screenBlur: number;
  setScreenBlur: (value: number) => void;
  spaceInfo: SpaceInfo;
  handleWorkMode: (start?: boolean) => Promise<void>;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
}

export function WorkModal({
  open,
  setOpen,
  isStartWork,
  setIsStartWork,
  videoBlur,
  setVideoBlur,
  screenBlur,
  setScreenBlur,
  space,
  spaceInfo,
  handleWorkMode,
  updateSettings,
}: WorkModalProps) {
  const { t } = useI18n();

  const isManager = useMemo(() => {
    return isSpaceManager(spaceInfo, space?.localParticipant.identity || '').isManager;
  }, [space, spaceInfo]);

  return (
    <Modal
      open={open}
      title={t('work.title')}
      okText={t('settings.device.screen.title')}
      cancelText={t('common.cancel')}
      onOk={async () => {
        setIsStartWork(true);
        await handleWorkMode(true);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
      centered
    >
      <div className={styles.work}>
        <div>{t('work.desc')}</div>
        <div className={styles.work_line}>
          {isManager && (
            <>
              <div className={styles.work_line}>
                <span> {t('more.participant.set.control.blur.video')}</span>
              </div>
              <Slider
                style={{ width: '100%' }}
                defaultValue={0.0}
                className={`${styles.common_space} ${styles.slider}`}
                value={videoBlur}
                min={0.0}
                max={1.0}
                step={0.05}
                onChange={(e) => {
                  setVideoBlur(e);
                }}
                onChangeComplete={(e) => {
                  setVideoBlur(e);
                }}
              />
              <div className={styles.work_line}>
                <span> {t('more.participant.set.control.blur.screen')}</span>
              </div>
              <Slider
                style={{ width: '100%' }}
                defaultValue={0.0}
                className={`${styles.common_space} ${styles.slider}`}
                value={screenBlur}
                min={0.0}
                max={1.0}
                step={0.05}
                onChange={(e) => {
                  setScreenBlur(e);
                }}
                onChangeComplete={(e) => {
                  setScreenBlur(e);
                }}
              />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
