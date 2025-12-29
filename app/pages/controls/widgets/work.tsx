import { useI18n } from '@/lib/i18n/i18n';
import { ViewAdjusts } from '@/lib/std/window';
import { LaptopOutlined, SmileOutlined } from '@ant-design/icons';
import { Button, Modal, Popover, Radio } from 'antd';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import { useMemo } from 'react';
import { RaiseKeeper } from './raise';
import { ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { useLocalParticipant } from '@livekit/components-react';
import { WsBase, WsTo } from '@/lib/std/device';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { audio } from '@/lib/audio';
import styles from '@/styles/controls.module.scss';

export interface WorkProps {
  showText?: boolean;
  size: SizeType;
  controlWidth: number;
  spaceInfo: SpaceInfo;
  space: string;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  setOpenModal: (open: boolean) => void;
}

export function Work({
  showText = true,
  controlWidth,
  spaceInfo,
  space,
  updateSettings,
  setOpenModal,
}: WorkProps) {
  const { t } = useI18n();
  const { localParticipant } = useLocalParticipant();
  const showTextOrHide = useMemo(() => {
    return ViewAdjusts(controlWidth).w720 ? false : showText;
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
        backgroundColor: '#1E1E1E',
        height: '46px',
        borderRadius: '8px',
        border: 'none',
        color: '#fff',
        minWidth: '50px',
        width: 'fit-content',
      }}
      icon={<LaptopOutlined />}
      onClick={() => setOpenModal(true)}
    >
      {showTextOrHide && t('work.start')}
    </Button>
  );
}

export interface WorkModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  isStartWork: boolean;
  setIsStartWork: (isStartWork: boolean) => void;
}

export function WorkModal({ open, setOpen, isStartWork, setIsStartWork }: WorkModalProps) {
  const { t } = useI18n();

  const saveAndClose = () => {
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      title={t('work.title')}
      footer={null}
      okText={''}
      cancelText={t('common.cancel')}
      onCancel={saveAndClose}
    >
      <div className={styles.work}>
        <div>{t('work.desc')}</div>
        <div className={styles.work_line}>
          <div className={styles.work_line}>
            <span> {t('work.start')}</span>
          </div>
          <div style={{ width: '100%' }}>
            <Radio.Group
              size="large"
              block
              value={isStartWork}
              onChange={(e) => setIsStartWork(e.target.value)}
            >
              <Radio.Button value={true}>{t('common.open')}</Radio.Button>
              <Radio.Button value={false}>{t('common.close')}</Radio.Button>
            </Radio.Group>
          </div>
        </div>
      </div>
    </Modal>
  );
}
