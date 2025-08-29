import { socket } from '@/app/rooms/[spaceName]/PageClientImpl';
import { SvgResource } from '@/app/resources/svg';
import { audio } from '@/lib/audio';
import { WsBase } from '@/lib/std/device';
import { LayoutContext } from '@livekit/components-react';

export interface RaiseHandProps {
  style?: React.CSSProperties;
  wsBase: WsBase;
  contextUndefined?: boolean;
}

export interface RaisePinProps {
  /**当Raise按钮被点击时触发 */
  raisePin: () => Promise<void>;
  style?: React.CSSProperties;
}

export function RaiseHand({ style, wsBase, contextUndefined = true }: RaiseHandProps) {
  const raisePin = async () => {
    socket.emit('raise', wsBase);
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
    left: '0.25rem',
    width: 'fit-content',
  },
}: RaisePinProps) {
  return (
    <button className="lk-button lk-focus-toggle-button" style={style} onClick={raisePin}>
      <SvgResource svgSize={16} type="hand"></SvgResource>
    </button>
  );
}
