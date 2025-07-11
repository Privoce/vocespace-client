// 用来读取vocespace.conf.json这个配置文件
// 这个配置文件的位置在项目根目录下
// 只会在服务器端使用
import { readFileSync } from 'fs';
import { join } from 'path';

export const getConfig = () => {
  try {
    const configPath = join(process.cwd(), 'vocespace.conf.json');
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent) as VocespaceConfig;
    return config;
  } catch (error) {
    console.error('Error reading vocespace.conf.json:', error);
    return DEFAULT_VOCESPACE_CONFIG;
  }
};

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

export interface VocespaceConfig {
  livekit: LivekitConf;
  resolution?: '360p' | '540p' | '720p' | '1080p' | '2k' | '4k';
  maxBitrate?: number;
  maxFramerate?: number;
  priority?: RTCPriorityType;
  redis: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  s3?: {
    access_key: string;
    secret_key: string;
    bucket: string;
    region: string;
  };
}

export const DEFAULT_VOCESPACE_CONFIG: VocespaceConfig = {
  livekit: {
    key: 'apikey',
    secret: 'secret',
    url: 'wss://localhost:7880',
  },
  resolution: '1080p',
  maxBitrate: 12000,
  maxFramerate: 30,
  priority: 'medium',
  redis: {
    enabled: true,
    host: 'localhost',
    port: 6379,
    password: 'vocespace',
    db: 0,
  },
};

// 暴露配置，给服务端使用，这样就可以在其他地方直接使用 STORED_CONF
export const STORED_CONF: VocespaceConfig = getConfig();
