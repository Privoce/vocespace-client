import { useI18n } from '@/lib/i18n/i18n';
import { ViewAdjusts } from '@/lib/std/window';
import { SmileOutlined } from '@ant-design/icons';
import { Button, Popover } from 'antd';
import { SizeType } from 'antd/es/config-provider/SizeContext';
import { useMemo } from 'react';
import { RaiseHand, RaiseKeeper } from './raise';
import { ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { LocalParticipant } from 'livekit-client';
import { useLocalParticipant } from '@livekit/components-react';
import { WsBase, WsTo } from '@/lib/std/device';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { audio } from '@/lib/audio';

export interface ReactionProps {
  showText?: boolean;
  size: SizeType;
  controlWidth: number;
  spaceInfo: SpaceInfo;
  space: string;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
}

export function Reaction({
  size,
  showText = true,
  controlWidth,
  spaceInfo,
  space,
  updateSettings,
}: ReactionProps) {
  const { t } = useI18n();
  const { localParticipant } = useLocalParticipant();
  const showTextOrHide = useMemo(() => {
    return ViewAdjusts(controlWidth).w720 ? false : showText;
  }, [controlWidth]);

  /**
   * 设置举手状态
   * @param raise
   */
  const setKeeping = async (raise: boolean) => {
    await updateSettings({
      raiseHand: raise,
    });
    socket.emit('update_user_status', {
      space,
    } as WsBase);
    if (raise) {
      await audio.raise();
    }
  };

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
    <Popover
      placement="top"
      trigger={['click']}
      content={<ReactionInner participant={participant} wsTo={wsTo} setKeeping={setKeeping} />}
    >
      <Button
        size="large"
        style={{
          backgroundColor: '#1E1E1E',
          height: '46px',
          borderRadius: '8px',
          border: 'none',
          color: '#fff',
        }}
        icon={<SmileOutlined />}
      >
        {showTextOrHide && t('reaction.title')}
      </Button>
    </Popover>
  );
}

export interface ReactionInnerProps {
  participant: ParticipantSettings;
  setKeeping: (keeping: boolean) => Promise<void>;
  wsTo: WsTo;
}

export function ReactionInner({ participant, setKeeping, wsTo }: ReactionInnerProps) {
  return (
    <div style={{ width: '140px', height: 'fit-content' }}>
      <RaiseKeeper
        isKeeping={participant.raiseHand}
        setKeeping={setKeeping}
        auth="write"
        wsTo={wsTo}
        isBtn={true}
        style={{
          backgroundColor: participant.raiseHand ? '#3f3f3f' : '#333',
          width: '100%',
          borderRadius: 4,
          padding: 4,
        }}
      ></RaiseKeeper>
    </div>
  );
}
