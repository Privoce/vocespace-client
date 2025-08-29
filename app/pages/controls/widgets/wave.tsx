import { socket } from '@/app/rooms/[spaceName]/PageClientImpl';
import { SvgResource } from '@/app/resources/svg';
import { audio } from '@/lib/audio';
import { WsWave } from '@/lib/std/device';
import { LayoutContext } from '@livekit/components-react';

export interface WavePinProps {
  /**当Wave按钮被点击时触发 */
  wavePin: () => Promise<void>;
  style?: React.CSSProperties;
}

export interface WaveHandProps {
  style?: React.CSSProperties;
  wsWave: WsWave | (() => WsWave);
  contextUndefined?: boolean;
}

/**
 * ## WaveHand 组件
 * 具有LayoutContext的消费能力, 应该在`ParticipantTile`中进行使用。（具有LayoutContext的组件下-默认）
 * - 用于发送Wave信号并播放音频。
 * - 当设置`contextUndefined`为`false`时，表示不使用LayoutContext。可单独使用，但无法自定义`wavePin`函数。
 * @param [`WavePinProps`]
 */
export function WaveHand({ style, wsWave, contextUndefined = true }: WaveHandProps) {
  const wavePin = async () => {
    let emitWave: WsWave;
    if (typeof wsWave === 'function') {
      emitWave = wsWave();
    } else {
      emitWave = wsWave;
    }

    socket.emit('wave', emitWave);
    await audio.wave();
  };

  if (contextUndefined) {
    return (
      <LayoutContext.Consumer>
        {(layoutContext) =>
          layoutContext !== undefined && <WavePin wavePin={wavePin} style={style} />
        }
      </LayoutContext.Consumer>
    );
  } else {
    return <WavePin wavePin={wavePin} style={style} />;
  }
}

/**
 * ### 基础的WavePin组件
 * - 接收`wavePin`函数作为点击事件处理器。可单独使用。
 * @param param0
 * @returns
 */
export function WavePin({
  wavePin,
  style = {
    left: '0.25rem',
    width: 'fit-content',
  },
}: WavePinProps) {
  return (
    <button className="lk-button lk-focus-toggle-button" style={style} onClick={wavePin}>
      <SvgResource svgSize={16} type="wave"></SvgResource>
    </button>
  );
}
