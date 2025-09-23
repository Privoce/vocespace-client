import { socket } from '@/app/[spaceName]/PageClientImpl';
import { SvgResource } from '@/app/resources/svg';
import { audio } from '@/lib/audio';
import { useI18n } from '@/lib/i18n/i18n';
import { WsSender } from '@/lib/std/device';
import { LayoutContext } from '@livekit/components-react';
import { Tooltip } from 'antd';
import { useMemo } from 'react';

export interface RaiseHandProps {
  style?: React.CSSProperties;
  wsSender: WsSender;
  contextUndefined?: boolean;
}

export interface RaisePinProps {
  /**当Raise按钮被点击时触发 */
  raisePin: () => Promise<void>;
  style?: React.CSSProperties;
}

export function RaiseHand({ style, wsSender, contextUndefined = true }: RaiseHandProps) {
  const raisePin = async () => {
    socket.emit('raise', wsSender);
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
    backgroundColor: '#000',
    margin: '0 4px',
    borderRadius: 4,
  },
}: RaisePinProps) {
  return (
    <button className="lk-button" style={style} onClick={raisePin}>
      <SvgResource svgSize={20} type="hand"></SvgResource>
    </button>
  );
}

export interface RaiseKeepProps {
  isKeeping: boolean;
  setKeeping: (keeping: boolean) => void;
  wsSender: WsSender;
  style?: React.CSSProperties;
  disabled?: boolean;
}

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
  wsSender,
  disabled = false,
  style = {
    width: 'fit-content',
    padding: 2,
    backgroundColor: '#000',
    margin: '0 4px',
    borderRadius: 4,
  },
}: RaiseKeepProps) {
  const { t } = useI18n();

  const btn = useMemo(() => {
    return (
      <button
        className="lk-button"
        style={{
          ...style,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onClick={() => {
          if (isKeeping) {
            setKeeping(false);
            socket.emit('raise_cancel', wsSender);
          }
        }}
      >
        <SvgResource svgSize={20} type="hand"></SvgResource>
      </button>
    );
  }, [isKeeping, style, setKeeping, wsSender, disabled]);

  if (disabled) {
    return btn;
  } else {
    return (
      <Tooltip title={t('common.cancel_raise')} placement="right">
        {btn}
      </Tooltip>
    );
  }
}
