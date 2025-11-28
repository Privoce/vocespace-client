import { socket } from '@/app/rooms/[spaceName]/PageClientImpl';
import { SvgResource } from '@/app/resources/svg';
import { audio } from '@/lib/audio';
import { useI18n } from '@/lib/i18n/i18n';
import { WsWave } from '@/lib/std/device';
import { LayoutContext } from '@livekit/components-react';
import { Tooltip } from 'antd';

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
    width: 'fit-content',
    padding: 4,
    backgroundColor: '#00000080',
    margin: '0 4px',
    borderRadius: 4,
  },
}: WavePinProps) {
  const { t } = useI18n();
  return (
    <Tooltip placement="bottom" title={t('more.participant.wave')}>
      <button className="lk-button" style={style} onClick={wavePin}>
        <SvgResource svgSize={16} type="wave"></SvgResource>
      </button>
    </Tooltip>
  );
}
