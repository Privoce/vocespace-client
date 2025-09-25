import { WsSender, WsTo, WsWave } from '@/lib/std/device';
import { RaiseAuth, RaiseHand, RaiseKeeper } from './raise';
import { WaveHand } from './wave';
import { useMemo } from 'react';

export interface TileActionCollectProps {
  style?: React.CSSProperties;
  contextUndefined?: boolean;
  wsWave: WsWave;
  isSelf: boolean;
  isHost: boolean;
  isKeepRaise: boolean;
  setIsKeepRaise: (keeping: boolean) => void;
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
  isSelf,
  isHost,
  isKeepRaise,
  setIsKeepRaise,
  wsWave,
}: TileActionCollectProps) {
  const wsSender = useMemo(() => {
    return {
      space: wsWave.space,
      senderName: wsWave.senderName,
      senderId: wsWave.senderId,
    } as WsSender;
  }, [wsWave]);

  const auth: RaiseAuth = useMemo(() => {
    return isSelf ? 'write' : isHost ? 'host' : 'read';
  }, [isSelf, isHost]);

  return (
    <div style={style}>
      {isKeepRaise && (
        <RaiseKeeper
          isKeeping={isKeepRaise}
          setKeeping={setIsKeepRaise}
          wsSender={wsSender}
          // disabled={!isSelf}
          auth={auth}
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
            <RaiseHand wsSender={wsSender} style={undefined} contextUndefined={contextUndefined} />
          )
        ) : (
          <WaveHand wsWave={{ ...wsWave }} style={undefined} contextUndefined={contextUndefined} />
        )}
      </div>
    </div>
  );
}
