// 用来读取vocespace.conf.json这个配置文件
// 这个配置文件的位置在项目根目录下
// 只会在服务器端使用
import { SliderMarks } from 'antd/es/slider';
import { VideoCodec, VideoPreset } from 'livekit-client';

export interface TurnConf {
  credential: string;
  username: string;
  urls: string[];
}

export interface LivekitConf {
  key: string;
  secret: string;
  url: string;
  turn?: TurnConf;
}

export type Resolution = '540p' | '720p' | '1080p' | '2k' | '4k';

export interface RedisConf {
  enabled: boolean;
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface S3Conf {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export interface RTCConf {
  codec: VideoCodec;
  resolution: Resolution;
  maxBitrate: number;
  maxFramerate: number;
  priority: RTCPriorityType;
}

export interface VocespaceConfig {
  livekit: LivekitConf;
  codec?: VideoCodec;
  resolution?: Resolution;
  maxBitrate?: number;
  maxFramerate?: number;
  priority?: RTCPriorityType;
  redis: RedisConf;
  s3?: S3Conf;
  /**
   * 服务器的主机地址，这可以用来检测你的令牌是否有效
   * 默认为 localhost
   * 如果你部署在云服务器上，请修改为你的服务器地址(域名)
   * 例如: vocespace.com
   * **无需加上 http:// 或 https:// 前缀，也无需端口号**
   */
  serverUrl: string;
  hostToken: string;
}

// 2k, 30fps, 3Mbps
export const DEFAULT_VOCESPACE_CONFIG: VocespaceConfig = {
  livekit: {
    key: 'apikey',
    secret: 'secret',
    url: 'wss://localhost:7880',
  },
  codec: 'vp9',
  resolution: '2k',
  maxBitrate: 3000000,
  maxFramerate: 30,
  priority: 'medium',
  redis: {
    enabled: true,
    host: 'localhost',
    port: 6379,
    password: 'vocespace',
    db: 0,
  },
  serverUrl: 'localhost',
  hostToken: 'vocespace_privoce',
};

const RTCVideoPresets = (options: {
  resolution?: Resolution;
  maxBitrate?: number;
  maxFramerate?: number;
  priority?: RTCPriorityType;
}): VideoPreset => {
  const resolution = options.resolution || '2k';
  switch (resolution) {
    case '4k':
      return new VideoPreset(
        3840,
        2160,
        options.maxBitrate || 8_000_000,
        options.maxFramerate || 30,
        options.priority || 'medium',
      );
    case '2k':
      return new VideoPreset(
        2560,
        1440,
        options.maxBitrate || 5_000_000,
        options.maxFramerate || 30,
        options.priority || 'medium',
      );
    case '1080p':
      return new VideoPreset(
        1920,
        1080,
        options.maxBitrate || 3_000_000,
        options.maxFramerate || 30,
        options.priority || 'medium',
      );
    case '720p':
      return new VideoPreset(
        1280,
        720,
        options.maxBitrate || 1_700_000,
        options.maxFramerate || 30,
        options.priority || 'medium',
      );
    case '540p':
      return new VideoPreset(
        960,
        540,
        options.maxBitrate || 800_000,
        options.maxFramerate || 25,
        options.priority || 'medium',
      );
    default:
      return new VideoPreset(
        1920,
        1080,
        options.maxBitrate || 3_000_000,
        options.maxFramerate || 30,
        options.priority || 'medium',
      );
  }
};

const lowResolutionLevelOnce = (resolution: Resolution): Resolution => {
  switch (resolution) {
    case '4k':
      return '2k';
    case '2k':
      return '1080p';
    case '1080p':
      return '720p';
    case '720p':
      return '540p';
    default:
      return '540p';
  }
};

const lowResolutionLevel = (resolution: Resolution, level: number): Resolution => {
  let res = resolution;
  for (let i = 0; i < level; i++) {
    res = lowResolutionLevelOnce(res);
  }
  return res;
};

/**
 * 创建视频画质/分辨率
 * @param options 基础配置
 * @param level 可降级数量，表示最多可以降低多少级别, [0, 4] 表示最多可降4级
 * @returns
 */
export const createRTCQulity = (
  options: {
    resolution?: Resolution;
    maxBitrate?: number;
    maxFramerate?: number;
    priority?: RTCPriorityType;
  },
  level: number,
): VideoPreset[] => {
  let lowLevel = level;
  if (level < 0 || level > 4) {
    lowLevel = 3;
  }
  const resolution = options.resolution || '2k';
  let videoPresets = [];
  for (let i = 0; i <= lowLevel; i++) {
    if (resolution === '540p') {
      break;
    }
    const res = lowResolutionLevel(resolution, i);
    videoPresets.push(
      RTCVideoPresets({
        resolution: res,
        maxBitrate: options.maxBitrate,
        maxFramerate: options.maxFramerate,
        priority: options.priority,
      }),
    );
  }
  return videoPresets;
};

export enum RTCLevel {
  /**
   * 流畅
   */
  Smooth,
  /**
   * 清晰
   */
  Standard,
  /**
   * 高清
   */
  High,
  /**
   * 超清
   */
  HD,
  /**
   * 极致
   */
  Ultra,
}

export const rtcLevelToNumber = (level: RTCLevel): number => {
  switch (level) {
    case RTCLevel.Smooth:
      return 0;
    case RTCLevel.Standard:
      return 25;
    case RTCLevel.High:
      return 50;
    case RTCLevel.HD:
      return 75;
    case RTCLevel.Ultra:
      return 100;
    default:
      return 50;
  }
};

export const numberToRTCLevel = (num: number): RTCLevel => {
  if (num < 25) {
    return RTCLevel.Smooth;
  } else if (num < 50) {
    return RTCLevel.Standard;
  } else if (num < 75) {
    return RTCLevel.High;
  } else if (num < 100) {
    return RTCLevel.HD;
  } else {
    return RTCLevel.Ultra;
  }
};

/**
 * ## 通过配置计算出对应的等级
 * - 流畅: 540p, 800kbps, 25fps
 * - 清晰: 720p, 1700kbps, 30fps
 * - 高清: 1080p, 3000kbps, 30fps
 * - 超清: 2k, 5000kbps, 30fps
 * - 极致: 4k, 10000kbps, 60fps
 * 我们不会直接去判断，而是通过数值加法得到分数然后转为等级
 * 分数计算方式:
 * - 分辨率: 满分33
 *   - 540p: 0
 *   - 720p: 8
 *   - 1080p: 16
 *   - 2k: 24
 *   - 4k: 33
 * - 码率: 满分33
 *  - 800kbps: 0
 *  - 1700kbps: 8
 *  - 3000kbps: 16
 *  - 5000kbps: 24
 *  - 10000kbps: 33
 * - 帧率: 满分34
 *  - 25fps: 8
 *  - 30fps: 16
 *  - 60fps: 34
 * 总分100，最后通过分数计算出对应的等级
 * @param conf
 */
export const countLevelByConf = (conf: RTCConf): RTCLevel => {
  const { resolution, maxBitrate, maxFramerate } = conf;

  let score = 0;

  // 计算分辨率得分
  score += resolutionToNumber(resolution);
  // 计算码率得分
  score += bitrateToNumber(maxBitrate);
  // 计算帧率得分
  score += framerateToNumber(maxFramerate);
  // 根据总分计算等级
  return numberToRTCLevel(score);
};

export const resolutionToNumber = (resolution: Resolution): number => {
  switch (resolution) {
    case '540p':
      return 0;
    case '720p':
      return 8;
    case '1080p':
      return 16;
    case '2k':
      return 24;
    case '4k':
      return 33;
    default:
      return 16;
  }
};

export const bitrateToNumber = (bitrate: number): number => {
  if (bitrate < 800_000) {
    return 0;
  } else if (bitrate < 1_700_000) {
    return 8;
  } else if (bitrate < 3_000_000) {
    return 16;
  } else if (bitrate < 5_000_000) {
    return 24;
  } else {
    return 33;
  }
};

export const framerateToNumber = (framerate: number): number => {
  if (framerate < 25) {
    return 0;
  } else if (framerate < 30) {
    return 8;
  } else if (framerate < 60) {
    return 16;
  } else {
    return 34;
  }
};

export const rtcLevelToConf = (level: RTCLevel): RTCConf => {
  switch (level) {
    case RTCLevel.Smooth:
      return {
        codec: 'vp9',
        resolution: '540p',
        maxBitrate: 800_000,
        maxFramerate: 25,
        priority: 'medium',
      };
    case RTCLevel.Standard:
      return {
        codec: 'vp9',
        resolution: '720p',
        maxBitrate: 1_700_000,
        maxFramerate: 30,
        priority: 'medium',
      };
    case RTCLevel.High:
      return {
        codec: 'vp9',
        resolution: '1080p',
        maxBitrate: 3_000_000,
        maxFramerate: 30,
        priority: 'medium',
      };
    case RTCLevel.HD:
      return {
        codec: 'vp9',
        resolution: '2k',
        maxBitrate: 5_000_000,
        maxFramerate: 30,
        priority: 'medium',
      };
    case RTCLevel.Ultra:
      return {
        codec: 'vp9',
        resolution: '4k',
        maxBitrate: 10_000_000,
        maxFramerate: 60,
        priority: 'medium',
      };
    default:
      return {
        codec: 'vp9',
        resolution: '1080p',
        maxBitrate: 3_000_000,
        maxFramerate: 30,
        priority: 'medium',
      };
  }
};

export const rtcNumberToConf = (num: number): RTCConf => {
  const level = numberToRTCLevel(num);
  return rtcLevelToConf(level);
};
