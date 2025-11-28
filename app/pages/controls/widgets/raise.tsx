import { socket } from '@/app/rooms/[spaceName]/PageClientImpl';
import { SvgResource } from '@/app/resources/svg';
import { audio } from '@/lib/audio';
import { useI18n } from '@/lib/i18n/i18n';
import { WsSender, WsTo } from '@/lib/std/device';
import { LayoutContext } from '@livekit/components-react';
import { Button, Popover, Tooltip } from 'antd';
import { useMemo } from 'react';

export interface RaiseHandProps {
  style?: React.CSSProperties;
  wsSender: WsSender;
  setRaiseHand?: () => Promise<void>;
  contextUndefined?: boolean;
}

export interface RaisePinProps {
  /**当Raise按钮被点击时触发 */
  raisePin: () => Promise<void>;
  style?: React.CSSProperties;
}

export function RaiseHand({
  style,
  wsSender,
  setRaiseHand,
  contextUndefined = true,
}: RaiseHandProps) {
  const raisePin = async () => {
    socket.emit('raise', wsSender);
    setRaiseHand && (await setRaiseHand());
    await audio.raise();
  };

  if (contextUndefined) {
    return (
      <LayoutContext.Consumer>
        {(layoutContext) =>
          layoutContext !== undefined && <RaisePin raisePin={raisePin} style={style} />
        }
      </LayoutContext.Consumer>
    );
  } else {
    return <RaisePin raisePin={raisePin} style={style} />;
  }
}

/**
 * ### 基础的RaisePin组件
 * - 接收`raisePin`函数作为点击事件处理器。可单独使用。
 * @param param0
 * @returns
 */
export function RaisePin({
  raisePin,
  style = {
    width: 'fit-content',
    padding: 2,
    backgroundColor: '#00000080',
    margin: '0 4px',
    borderRadius: 4,
  },
}: RaisePinProps) {
  const { t } = useI18n();
  return (
    <Tooltip title={t('more.app.raise.title')} placement="bottom">
      <button className="lk-button" style={style} onClick={raisePin}>
        <SvgResource svgSize={20} type="hand"></SvgResource>
      </button>
    </Tooltip>
  );
}

export interface RaiseKeepProps {
  isKeeping: boolean;
  setKeeping: (keeping: boolean) => Promise<void>;
  wsTo: WsTo;
  style?: React.CSSProperties;
  auth: RaiseAuth;
  isBtn?: boolean;
}

/**
 * ### RaiseKeeper 组件的权限类型
 * - "host": 仅主持人可见，主持人有权限：1. 取消举手 2. 立即发言 (支持人允许该用户发言)
 * - "read": 他人只读，表示其他人只能看到该用户的Raise状态，但无法进行任何操作
 * - "write": 自己可操作，自己只能取消举手
 */
export type RaiseAuth = 'host' | 'read' | 'write';

/**
 * ## RaiseKeeper 组件
 * RaiseKeeper是对RaisePin在用户处于举手状态下长时间保持Raise状态的封装。
 * - 该组件会在用户点击Raise按钮后，持续发送Raise信号，直到用户取消Raise状态。
 * - 适用于需要长时间保持Raise状态的场景，如会议中需要持续引起注意的情况。
 * - RaiseKeeper不会消费任何活动，只含有取消功能
 */
export function RaiseKeeper({
  isKeeping,
  setKeeping,
  wsTo,
  auth,
  style = {
    width: 'fit-content',
    padding: 2,
    backgroundColor: '#000',
    margin: '0 4px',
    borderRadius: 4,
  },
  isBtn = false,
}: RaiseKeepProps) {
  const { t } = useI18n();
  /**
   * 举手按钮
   * - 当只有读权限时，按钮不可点击
   * - 当有写权限时，按钮可点击，点击后取消举手
   * - 当有主持人权限时，按钮可点击，点击后弹出操作菜单，包含接受和拒绝选项
   */
  const btn = useMemo(() => {
    let btnStyle = {
      ...style,
      cursor: auth === 'read' ? 'not-allowed' : 'pointer',
      color: '#fff',
    };

    return (
      <button
        className="lk-button"
        style={btnStyle}
        onClick={async () => {
          if (!isBtn) {
            if (isKeeping && auth === 'write') {
              await setKeeping(false);
            }
          } else {
            if (auth === 'write') {
              await setKeeping(!isKeeping);
            }
          }
        }}
      >
        <SvgResource svgSize={20} type="hand"></SvgResource>
        {isBtn && <span>{isKeeping ? t('more.app.raise.cancel') : t('more.app.raise.title')}</span>}
      </button>
    );
  }, [isKeeping, style, setKeeping, auth, isBtn]);
  if (!isBtn) {
    if (auth === 'read') {
      return btn;
    }
    if (auth === 'write') {
      return (
        <Tooltip title={t('more.app.raise.cancel')} placement="bottom">
          {btn}
        </Tooltip>
      );
    }

    if (auth === 'host') {
      return (
        <Popover
          title={t('more.app.raise.handle.title')}
          content={
            <RaiseHandler onAccept={() => acceptRaise(wsTo)} onReject={() => rejectRaise(wsTo)} />
          }
          placement="bottom"
        >
          {btn}
        </Popover>
      );
    }
  } else {
    return btn;
  }
}

export interface RaiseHandlerProps {
  onAccept?: () => void;
  onReject?: () => void;
}

export function RaiseHandler({ onAccept, onReject }: RaiseHandlerProps) {
  const { t } = useI18n();

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      {onAccept && (
        <Tooltip title={t('more.app.raise.handle.accept_desc')} placement="bottom">
          <Button color="primary" size="small" variant="solid" onClick={onAccept}>
            {t('more.app.raise.handle.accept')}
          </Button>
        </Tooltip>
      )}
      {onReject && (
        <Tooltip title={t('more.app.raise.handle.reject_desc')} placement="bottom">
          <Button color="danger" size="small" variant="solid" onClick={onReject}>
            {t('more.app.raise.handle.reject')}
          </Button>
        </Tooltip>
      )}
    </div>
  );
}

export const rejectRaise = async (wsTo: WsTo) => {
  socket.emit('raise_cancel', wsTo);
};

export const acceptRaise = async (wsTo: WsTo) => {
  socket.emit('raise_accept', wsTo);
};
