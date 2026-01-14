import { useI18n } from '@/lib/i18n/i18n';
import { ViewAdjusts } from '@/lib/std/window';
import { LaptopOutlined } from '@ant-design/icons';
import { Button, Modal, Radio, Slider } from 'antd';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AICutParticipantConf, ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { useLocalParticipant } from '@livekit/components-react';
import { WsBase, WsTo } from '@/lib/std/device';
import styles from '@/styles/controls.module.scss';
import { Room } from 'livekit-client';
import { api } from '@/lib/api';
import { MessageInstance } from 'antd/es/message/interface';
import equal from 'fast-deep-equal';
import { isSpaceManager } from '@/lib/std';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { AICutAnalysisSettingsPanel, useAICutAnalysisSettings } from './ai';

export interface UseWorkProps {
  spaceInfo: SpaceInfo;
  space?: Room;
  startOrStopAICutAnalysis: (
    freq: number,
    conf: AICutParticipantConf,
    reload?: boolean,
  ) => Promise<void>;
  openAIService: (value: {
    openAIService: boolean;
    noteClosed: boolean;
    hasAsked: boolean;
  }) => void;
  messageApi: MessageInstance;
  downloadAIMdReport?: () => Promise<void>;
}

export const useWork = ({
  spaceInfo,
  space,
  startOrStopAICutAnalysis,
  openAIService,
  messageApi,
  downloadAIMdReport,
}: UseWorkProps) => {
  const { t } = useI18n();
  const [openModal, setOpenModal] = useState(false);
  const [enabled, setEnabeled] = useState(false);
  const [isUseAI, setIsUseAI] = useState(true);
  const [isSync, setIsSync] = useState(false);
  const [videoBlur, setVideoBlur] = useState(0.0);
  const [screenBlur, setScreenBlur] = useState(0.0);
  // 数据初始化和同步
  useEffect(() => {
    if (space) {
      const { useAI, sync, videoBlur, screenBlur } = spaceInfo.work;
      const isEnabled =
        spaceInfo.participants[space.localParticipant.identity]?.work.enabled || false;
      setEnabeled(isEnabled);
      setIsUseAI(useAI);
      setIsSync(sync);
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
      const { spent, todo, extraction, blur, enabled } =
        spaceInfo.participants[space.localParticipant.identity].ai.cut;

      // 成功开启/关闭了工作模式
      if (workType) {
        if (isUseAI) {
          if (enabled && !space.localParticipant.isScreenShareEnabled) {
            // 没开启屏幕共享，但开启了AI，说明出现了问题，提示用户开启屏幕共享
            space?.localParticipant.setScreenShareEnabled(true);
          } else if (!enabled && space.localParticipant.isScreenShareEnabled) {
            // 没开启AI，但开启了屏幕共享，需要开启AI
            await startOrStopAICutAnalysis(spaceInfo.ai.cut.freq, {
              enabled: true,
              spent,
              todo,
              extraction,
              blur,
            });
          } else if (!enabled && !space.localParticipant.isScreenShareEnabled) {
            // 没开启AI，也没开启屏幕共享，需要两个都开启
            space?.localParticipant.setScreenShareEnabled(true);
            openAIService({
              hasAsked: true,
              openAIService: true,
              noteClosed: true,
            });
          } else {
            // 开启AI且屏幕共享，或者不开就不用管了
          }
        } else {
          // 不开启AI，也要开启屏幕共享
          if (!space.localParticipant.isScreenShareEnabled) {
            space.localParticipant.setScreenShareEnabled(true);
          }
        }

        messageApi.success(t('work.mode.start.success'));
      } else {
        // 关闭用户AI分析和屏幕共享
        space.localParticipant.setScreenShareEnabled(false);

        if (isUseAI && enabled) {
          await startOrStopAICutAnalysis(spaceInfo.ai.cut.freq, {
            enabled: false,
            spent,
            todo,
            extraction,
            blur,
          });
          downloadAIMdReport && (await downloadAIMdReport());
        }
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
        useAI: isUseAI,
        sync: isSync,
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
      isUseAI,
      isSync,
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
    setEnabeled,
    isUseAI,
    setIsUseAI,
    isSync,
    setIsSync,
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
}

export function Work({
  showText = true,
  controlWidth,
  spaceInfo,
  space,
  startOrStopWork,
  setOpenModal,
  isStartWork,
  setIsStartWork,
}: WorkProps) {
  if (!spaceInfo.ai.cut.enabled) {
    return <></>;
  }

  const { t } = useI18n();
  const { localParticipant } = useLocalParticipant();
  const showTextOrHide = useMemo(() => {
    return ViewAdjusts(controlWidth).w960 ? false : showText;
  }, [controlWidth]);

  const participant = useMemo(() => {
    return spaceInfo.participants[localParticipant.identity];
  }, [spaceInfo, localParticipant]);

  const wsTo = useMemo(() => {
    return {
      space,
      senderId: localParticipant.identity,
      senderName: localParticipant?.name ?? participant?.name ?? localParticipant.identity,
      receiverId: spaceInfo.ownerId,
      socketId: spaceInfo.participants[spaceInfo.ownerId]?.socketId,
      senderSocketId: participant?.socketId,
    } as WsTo;
  }, [spaceInfo, space]);

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
          // setIsStartWork(false);
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
  isUseAI: boolean;
  setIsUseAI: (isUseAI: boolean) => void;
  isSync: boolean;
  setIsSync: (isSync: boolean) => void;
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
  isUseAI,
  setIsUseAI,
  isSync,
  setIsSync,
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

  const {
    aiCutDeps,
    setAICutDeps,
    extraction,
    setExtraction,
    cutFreq,
    setCutFreq,
    cutBlur,
    setCutBlur,
    isServiceOpen,
    setIsServiceOpen,
    aiCutOptions,
    aiCutOptionsChange,
  } = useAICutAnalysisSettings({
    space,
    spaceInfo,
  });

  const isManager = useMemo(() => {
    return isSpaceManager(spaceInfo, space?.localParticipant.identity || '').isManager;
  }, [space, spaceInfo]);

  const saveAICutSettings = async () => {
    if (!space) return;

    if (cutFreq !== spaceInfo.ai.cut.freq) {
      const response = await api.updateSpaceInfo(space.name, {
        ai: {
          cut: {
            ...spaceInfo.ai.cut,
            freq: cutFreq,
          },
        },
      });

      if (!response.ok) {
        let { error } = await response.json();
        throw new Error(error);
      }
    }
    if (
      spaceInfo.participants[space.localParticipant.identity].ai.cut.extraction !== extraction ||
      spaceInfo.participants[space.localParticipant.identity].ai.cut.spent !==
        aiCutDeps.includes('spent') ||
      spaceInfo.participants[space.localParticipant.identity].ai.cut.todo !==
        aiCutDeps.includes('todo')
    ) {
      const update = await updateSettings({
        ai: {
          cut: {
            ...spaceInfo.participants[space.localParticipant.identity].ai.cut,
            extraction: extraction,
            spent: aiCutDeps.includes('spent'),
            todo: aiCutDeps.includes('todo'),
            blur: cutBlur,
          },
        },
      });

      if (!update) {
        throw new Error(t('settings.ai.update.error'));
      }
    }
  };

  // 保存并关闭, 检测如果有更改则保存
  const saveAndClose = async () => {
    setIsStartWork(true);

    try {
      let _res1 = await saveAICutSettings();
      setTimeout(async () => {
        let _res2 = await handleWorkMode(true);
      }, 1000);
    } catch (error) {
      console.error(error);
    } finally {
      setOpen(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('work.title')}
      okText={t('settings.device.screen.title')}
      cancelText={t('common.cancel')}
      onOk={saveAndClose}
      onCancel={() => setOpen(false)}
      centered
    >
      <div className={styles.work}>
        <div>{t('work.desc')}</div>
        <div className={styles.work_line}>
          <AICutAnalysisSettingsPanel
            space={space}
            spaceInfo={spaceInfo}
            aiCutDeps={aiCutDeps}
            setAICutDeps={setAICutDeps}
            extraction={extraction}
            setExtraction={setExtraction}
            cutFreq={cutFreq}
            setCutFreq={setCutFreq}
            cutBlur={cutBlur}
            setCutBlur={setCutBlur}
            isServiceOpen={isServiceOpen}
            setIsServiceOpen={setIsServiceOpen}
            aiCutOptions={aiCutOptions}
            aiCutOptionsChange={aiCutOptionsChange}
            isManager={isManager}
          ></AICutAnalysisSettingsPanel>

          {isManager && (
            <>
              <div className={styles.work_line}>
                <span> {t('work.use_ai')}</span>
              </div>
              <div style={{ width: '100%' }}>
                <Radio.Group
                  size="large"
                  block
                  value={isUseAI}
                  onChange={(e) => setIsUseAI(e.target.value)}
                >
                  <Radio.Button value={true}>{t('common.open')}</Radio.Button>
                  <Radio.Button value={false}>{t('common.close')}</Radio.Button>
                </Radio.Group>
              </div>

              {/* <div className={styles.work_line}>
                <span> {t('work.sync')}</span>
              </div> */}
              {/* <div style={{ width: '100%' }}>
                <Radio.Group
                  size="large"
                  block
                  value={isSync}
                  onChange={(e) => setIsSync(e.target.value)}
                >
                  <Radio.Button value={true}>{t('common.open')}</Radio.Button>
                  <Radio.Button value={false}>{t('common.close')}</Radio.Button>
                </Radio.Group>
              </div> */}
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
