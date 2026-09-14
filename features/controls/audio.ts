import { src } from '@/lib/http/paths';

export enum AudioType {
  Wave = 'vocespacewave.m4a',
  Raise = 'vocespaceraise.mp3',
}

/**
 * ## 音频播放函数
 * @param audio_type 音频类型
 * @param during 音频播放时长，默认2000毫秒
 */
const audioShow = async (audio_type: AudioType, during: number = 2000) => {
  const audioSrc = src(`/audios/${audio_type}`);
  const audio = new Audio(audioSrc);
  audio.volume = 1.0;
  let _ = await audio.play();
  setTimeout(() => {
    audio.pause();
    audio.currentTime = 0;
    audio.remove();
  }, during);
};

/**
 * 播放Wave音频
 */
const wave = () => audioShow(AudioType.Wave);

const raise = () => audioShow(AudioType.Raise);

/**
 * ## 音频模块
 * 1. `audioShow` - 播放指定类型的音频，需要注意的是，音频文件需要放在 `public/audios/` 目录下。
 * 2. `wave` - 播放Wave音频
 *
 */
export const audio = {
  audioShow,
  wave,
  raise,
};
