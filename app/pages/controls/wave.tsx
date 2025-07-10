import { socket } from '@/app/[roomName]/PageClientImpl';
import { SvgResource } from '@/app/resources/svg';
import { src } from '@/lib/std';
import { WsTo } from '@/lib/std/device';
import { LayoutContext, LayoutContextType } from '@livekit/components-react';

export interface WavePinProps {
  wavePin: () => Promise<void>;
  style?: React.CSSProperties;
}

export interface WaveHandProps {
  style?: React.CSSProperties;
  wsTo: WsTo;
  contextUndefined?: boolean;
}

export function WaveHand({ style, wsTo, contextUndefined = true }: WaveHandProps) {
  const wavePin = async () => {
    socket.emit('wave', wsTo);
    // 创建一个虚拟的audio元素并播放音频，然后移除
    const audioSrc = src('/audios/vocespacewave.m4a');
    const audio = new Audio(audioSrc);
    audio.volume = 1.0;
    audio.play().then(() => {
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.remove();
      }, 2000);
    });
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
