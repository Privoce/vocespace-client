import { WsSender, WsTo, WsWave } from '@/lib/std/device';
import { RaiseAuth, RaiseHand, RaiseKeeper } from './raise';
import { WaveHand } from './wave';
import { useMemo } from 'react';
import { ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { Participant } from 'livekit-client';

export interface TileActionCollectProps {
  style?: React.CSSProperties;
  contextUndefined?: boolean;
  wsWave: WsWave;
  setIsKeepRaise: (keeping: boolean) => Promise<void>;
  participantId: string;
  spaceInfo: SpaceInfo;
  /**
   * 本地参与者的信息
   */
  localParticipant: Participant;
}

export function TileActionCollect({
  style = {
    left: 0,
    backgroundColor: 'transparent',
    padding: 0,
    top: 4,
    width: 'fit-content',
    position: 'absolute',
    zIndex: 111,
  },
  contextUndefined,
  spaceInfo,
  setIsKeepRaise,
  participantId,
  localParticipant,
  wsWave,
}: TileActionCollectProps) {
  const wsSender = useMemo(() => {
    return {
      space: wsWave.space,
      senderName: wsWave.senderName,
      senderId: wsWave.senderId,
    } as WsSender;
  }, [wsWave]);

  const isSelf = useMemo(() => {
    return participantId === localParticipant.identity;
  }, [participantId, localParticipant]);

  const isHost = useMemo(() => {
    return spaceInfo.ownerId === localParticipant.identity;
  }, [spaceInfo, localParticipant]);

  const isKeepRaise = useMemo(() => {
    return spaceInfo.participants[participantId]?.raiseHand ?? false;
  }, [spaceInfo, participantId]);

  const auth: RaiseAuth = useMemo(() => {
    return isSelf ? 'write' : isHost ? 'host' : 'read';
  }, [isSelf, isHost]);

  return (
    <div style={style}>
      {isKeepRaise && (
        <RaiseKeeper
          isKeeping={isKeepRaise}
          setKeeping={setIsKeepRaise}
          wsTo={{
            ...wsSender,
            receiverId: spaceInfo.ownerId,
            socketId: spaceInfo.participants[spaceInfo.ownerId]?.socketId || '',
          }}
          auth={auth}
          participant={spaceInfo.participants[participantId]}
          localParticipant={localParticipant}
        ></RaiseKeeper>
      )}
      <div
        className="lk-focus-toggle-button"
        style={{
          top: 0,
          backgroundColor: 'transparent',
          height: 'fit-content',
          width: 'fit-content',
          left: isKeepRaise ? 28 : 0,
          margin: 0,
          padding: 0,
          gap: 4,
        }}
      >
        {' '}
        {isSelf ? (
          !isKeepRaise && (
            <RaiseHand
              wsSender={wsSender}
              style={undefined}
              contextUndefined={contextUndefined}
              setRaiseHand={async () => {
                await setIsKeepRaise(true);
              }}
            />
          )
        ) : (
          <WaveHand wsWave={{ ...wsWave }} style={undefined} contextUndefined={contextUndefined} />
        )}
      </div>
    </div>
  );
}
