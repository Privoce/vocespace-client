import { useI18n } from '@/lib/i18n/i18n';
import { AppKey, ParticipantSettings } from '@/lib/std/space';
import { AppstoreOutlined } from '@ant-design/icons';
import { LayoutContext } from '@livekit/components-react';
import { Tooltip } from 'antd';

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
  style = {
    width: 'fit-content',
    padding: 4,
    backgroundColor: '#00000080',
    margin: '0 4px',
    borderRadius: 4,
  },
}: AppPinProps) {
  const { t } = useI18n();
  return (
    <Tooltip placement="bottom" title={t(`more.app.title`)}>
      <button className="lk-button" style={style} onClick={pin}>
        <AppstoreOutlined />
      </button>
    </Tooltip>
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
      {participant.sync.length > 0 && (
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
