import { DEFAULT_VOCESPACE_CONFIG, VocespaceConfig } from '@/lib/std/conf';
import { EnvConf } from '@/lib/std/env';
import { readFileSync, writeFileSync } from 'fs';
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

export const setConfigEnv = (
  env: EnvConf,
): {
  success: boolean;
  error?: Error;
} => {
  try {
    // 更新vocespace.conf.json
    let config: VocespaceConfig = getConfig();
    config.resolution = env.resolution;
    config.maxBitrate = env.maxBitrate;
    config.maxFramerate = env.maxFramerate;
    config.codec = env.codec;
    // 设置到文件中
    const configPath = join(process.cwd(), 'vocespace.conf.json');
    writeFileSync(configPath, JSON.stringify(config));
    return {
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: e instanceof Error ? e : new Error('can not update env'),
    };
  }
};

// 暴露配置，给服务端使用，这样就可以在其他地方直接使用 STORED_CONF
export let STORED_CONF: VocespaceConfig = getConfig();

export const setStoredConf = (conf: VocespaceConfig) => {
  STORED_CONF = conf;
};
