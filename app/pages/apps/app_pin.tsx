import { AppKey, ParticipantSettings } from '@/lib/std/space';
import { CarryOutOutlined, ClockCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { LayoutContext } from '@livekit/components-react';

export interface AppPinProps {
  appKey: AppKey;
  pin: () => void;
  style?: React.CSSProperties;
}

export interface AppFlotIconProps extends AppPinProps {
  contextUndefined?: boolean;
}

export function AppFlotIcon({ style, pin, appKey, contextUndefined = true }: AppFlotIconProps) {
  if (contextUndefined) {
    return (
      <LayoutContext.Consumer>
        {(layoutContext) =>
          layoutContext !== undefined && (
            <AppFlotPin appKey={appKey} pin={pin} style={style}></AppFlotPin>
          )
        }
      </LayoutContext.Consumer>
    );
  } else {
    return <AppFlotPin appKey={appKey} pin={pin} style={style}></AppFlotPin>;
  }
}

export function AppFlotPin({
  pin,
  appKey,
  style = {
    width: 'fit-content',
    padding: 4,
    backgroundColor: '#000',
    margin: '0 4px',
    borderRadius: 4,
  },
}: AppPinProps) {
  return (
    <button className="lk-button" style={style} onClick={pin}>
      {appKey === 'timer' && <ClockCircleOutlined />}
      {appKey === 'countdown' && <HistoryOutlined />}
      {appKey === 'todo' && <CarryOutOutlined />}
    </button>
  );
}

export interface AppFlotIconCollectProps {
  showApp: (appKey: AppKey) => void;
  participant?: ParticipantSettings;
  style?: React.CSSProperties;
  contextUndefined?: boolean;
}

export function AppFlotIconCollect({
  showApp,
  participant,
  contextUndefined,
  style = { right: '32px', backgroundColor: 'transparent', padding: 0 },
}: AppFlotIconCollectProps) {
  return participant && participant.sync ? (
    <div className="lk-focus-toggle-button" style={style}>
      {participant.sync.includes('timer') && (
        <AppFlotIcon
          appKey="timer"
          pin={() => showApp('timer')}
          contextUndefined={contextUndefined}
        ></AppFlotIcon>
      )}
      {participant.sync.includes('countdown') && (
        <AppFlotIcon
          appKey="countdown"
          pin={() => showApp('countdown')}
          contextUndefined={contextUndefined}
        ></AppFlotIcon>
      )}
      {participant.sync.includes('todo') && (
        <AppFlotIcon
          appKey="todo"
          pin={() => showApp('todo')}
          contextUndefined={contextUndefined}
        ></AppFlotIcon>
      )}
    </div>
  ) : (
    <div></div>
  );
}
