// 用来读取vocespace.conf.json这个配置文件
// 这个配置文件的位置在项目根目录下
// 只会在服务器端使用
import type { VideoCodec } from './model';
import { DEFAULT_LICENSE } from './license';

export interface TurnConf {
  credential?: string;
  username?: string;
  urls: string | string[];
}

export interface LivekitConf {
  key: string;
  secret: string;
  url: string;
  turn?: TurnConf[];
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
  priority: Priority;
}

export interface AIConf {
  enabled: boolean;
  apiKey: string;
  apiUrl: string;
  model: string;
  maxTokens?: number;
}

export interface SMTPConf {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface HyperbeamConf {
  apiKey: string;
  apiBase?: string;
  defaultStartUrl?: string;
}

/**
 * 创建空间的策略
 * all: 允许所有用户创建空间
 * white: 仅允许白名单用户创建空间
 * white_platform: 仅允许白名单用户和平台用户创建空间
 */
export type CreateSpaceStrategy = 'all' | 'white' | 'white_platform';

/**
 * 可以被前端读取的配置项，不包含敏感信息
 */
export interface ReadableConf {
  livekit: LivekitConf;
  codec?: VideoCodec;
  resolution?: Resolution;
  maxBitrate?: number;
  maxFramerate?: number;
  priority?: Priority;
  serverUrl: string;
  license: string;
  ai?: AIConf; // 必须传递hostToken给后端校验成功才能传递这个配置
  smtp?: SMTPConf; // 必须传递hostToken给后端校验成功才能传递这个配置
  hyperbeam?: HyperbeamConf; // 必须传递hostToken给后端校验成功才能传递这个配置
  whiteList?: string[]; // 允许创建空间的白名单用户列表
  initialized?: boolean;
  /**
   * 创建空间的策略
   */
  create_space: CreateSpaceStrategy;
  /**
   * 房间证书列表
   */
  roomLicenses?: {
    name: string;
    license: string;
  }[];
}

export interface VocespaceConfig {
  livekit: LivekitConf;
  codec?: VideoCodec;
  resolution?: Resolution;
  maxBitrate?: number;
  maxFramerate?: number;
  priority?: Priority;
  /**
   * redis configuration for presence and other features
   */
  redis: RedisConf;
  /**
   * s3 storage for recording and snapshots configuration
   */
  s3?: S3Conf;
  /**
   * 服务器的主机地址，这可以用来检测你的令牌是否有效
   * 默认为 localhost
   * 如果你部署在云服务器上，请修改为你的服务器地址(域名)
   * 例如: vocespace.com
   * **无需加上 http:// 或 https:// 前缀，也无需端口号**
   */
  serverUrl: string;
  /**
   * host token for dashboard resolution control
   * 默认值: vocespace_privoce
   * 通过这个令牌，你可以在仪表盘中控制房间的分辨率
   */
  hostToken: string;
  /**
   * 房间的许可证，用户可以购买某个房间的许可证来开启特殊功能，例如房间录制功能，即使是免费的服务器许可证也可以直接购买
   * 而一般来说，用户如果直接购买服务器许可证那么不再需要购买房间许可证了，而房间许可证较为便宜，用户可按需购买
   */
  roomLicenses?: {
    name: string;
    license: string;
  }[];
  /**
   * 服务器的许可证，用于验证用户令牌是否有效, 所有人都会有默认100年的免费许可证
   */
  license: string;
  /**
   * AI 配置项，当前用于AI进行会议截图内容分析
   * 由于AI需要进行图片分析，所以用户需要选择使用多模态AI模型
   * 模型推荐：
   * | 模型名称                           | 所属公司      | 支持模态        | 主要特点                    |
   * | --------------------------------- | --------- | ----------- | ----------------------- |
   * | GPT-4V / GPT-4o                   | OpenAI    | 文本、图像、音频    | 综合能力强，图像理解和文本生成表现优异     |
   * | Claude 3.5 Sonnet                 | Anthropic | 文本、图像       | 编程与推理能力强，适用于逻辑性图像任务     |
   * | Gemini 1.5 Pro / Gemini 2.0 Flash | Google    | 文本、图像、音频、视频 | 支持长视频理解，多媒体处理能力强        |
   * | Qwen2.5-VL-72B                    | 阿里巴巴      | 文本、图像、视频    | 中文理解能力强，视觉问答表现突出        |
   * | 文心一言多模态版                     | 百度        | 文本、图像、语音    | 中文本土化优化，适合中文多媒体内容处理     |
   * | 混元Vision                         | 腾讯        | 文本、图像       | 中文任务优化，SuperCLUE-V测评中领先 |
   */
  ai?: AIConf;
  smtp?: SMTPConf;
  hyperbeam?: HyperbeamConf;
  /**
   * 创建空间的策略
   */
  create_space: CreateSpaceStrategy;
  whiteList?: string[]; // 允许创建空间的白名单用户列表
}

export const mergeConf = (oldConf: VocespaceConfig, newConf: ReadableConf): VocespaceConfig => {
  const { initialized: _initialized, ...nextConf } = newConf;
  return {
    ...oldConf,
    ...nextConf,
    livekit: {
      ...oldConf.livekit,
      ...nextConf.livekit,
    },
    redis: oldConf.redis,
    s3: oldConf.s3,
    ai: {
      ...oldConf.ai!,
      ...(nextConf.ai ? nextConf.ai : oldConf.ai),
    },
    smtp: nextConf.smtp
      ? {
          ...oldConf.smtp,
          ...nextConf.smtp,
        }
      : oldConf.smtp,
    hyperbeam: nextConf.hyperbeam
      ? {
          ...oldConf.hyperbeam,
          ...nextConf.hyperbeam,
        }
      : oldConf.hyperbeam,
  };
};

/**
 * 清理配置中的敏感信息，只留下可读的配置项
 * 需要验证传入的hostToken，如果正确则可以传递AI配置
 * @param conf
 */
export const clearReadableConf = (
  conf: VocespaceConfig,
  hostToken?: string | null,
): ReadableConf => {
  const readableConf: ReadableConf = {
    livekit: hostToken && conf.hostToken && hostToken === conf.hostToken
      ? { ...conf.livekit }
      : { url: conf.livekit.url, turn: conf.livekit.turn, key: '', secret: '' },
    codec: conf.codec,
    resolution: conf.resolution,
    maxBitrate: conf.maxBitrate,
    maxFramerate: conf.maxFramerate,
    priority: conf.priority,
    serverUrl: conf.serverUrl,
    license: conf.license,
    create_space: conf.create_space,
    whiteList: conf.whiteList,
    roomLicenses: conf.roomLicenses,
  };
  // 如果hostToken正确，则传递AI配置
  if (hostToken && hostToken === conf.hostToken && conf.ai) {
    readableConf.ai = conf.ai;
  }
  if (hostToken && hostToken === conf.hostToken && conf.smtp) {
    readableConf.smtp = conf.smtp;
  }
  if (hostToken && hostToken === conf.hostToken && conf.hyperbeam) {
    readableConf.hyperbeam = conf.hyperbeam;
  }
  return readableConf;
};

const normalizeConfigForCompare = (
  conf?: Partial<VocespaceConfig> | ReadableConf | null,
): Record<string, unknown> => {
  const defaults = DEFAULT_VOCESPACE_CONFIG as VocespaceConfig;
  // 同时支持 ReadableConf 与 Partial<VocespaceConfig>，用 Partial<VocespaceConfig> 视图以访问 redis/s3
  const nextConf = (conf || {}) as Partial<VocespaceConfig>;

  return {
    livekit: {
      ...defaults.livekit,
      ...(nextConf.livekit || {}),
    },
    codec: nextConf.codec ?? defaults.codec,
    resolution: nextConf.resolution ?? defaults.resolution,
    maxBitrate: nextConf.maxBitrate ?? defaults.maxBitrate,
    maxFramerate: nextConf.maxFramerate ?? defaults.maxFramerate,
    priority: nextConf.priority ?? defaults.priority,
    redis: {
      ...defaults.redis,
      ...(nextConf.redis || {}),
    },
    s3: nextConf.s3 ?? defaults.s3 ?? null,
    serverUrl: nextConf.serverUrl ?? defaults.serverUrl,
    hostToken: 'hostToken' in nextConf ? nextConf.hostToken ?? defaults.hostToken : defaults.hostToken,
    license: nextConf.license ?? defaults.license,
    ai: nextConf.ai ?? defaults.ai ?? null,
    smtp: {
      ...defaults.smtp,
      ...(nextConf.smtp || {}),
    },
    hyperbeam: {
      ...defaults.hyperbeam,
      ...(nextConf.hyperbeam || {}),
    },
    create_space: nextConf.create_space ?? defaults.create_space,
    whiteList: nextConf.whiteList ?? [],
    roomLicenses: nextConf.roomLicenses ?? [],
  };
};

export const isDefaultVocespaceConfig = (
  conf?: Partial<VocespaceConfig> | ReadableConf | null,
): boolean => {
  return (
    JSON.stringify(normalizeConfigForCompare(conf)) ===
    JSON.stringify(normalizeConfigForCompare(DEFAULT_VOCESPACE_CONFIG as VocespaceConfig))
  );
};

// 2k, 30fps, 3Mbps
export const DEFAULT_VOCESPACE_CONFIG: VocespaceConfig | ReadableConf = {
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
  license: DEFAULT_LICENSE.value,
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
  },
  hyperbeam: {
    apiKey: '',
    apiBase: 'https://engine.hyperbeam.com',
    defaultStartUrl: 'https://www.google.com/search?q=',
  },
  create_space: 'all',
  whiteList: [],
};

export type Priority = 'very-low' | 'low' | 'medium' | 'high';
