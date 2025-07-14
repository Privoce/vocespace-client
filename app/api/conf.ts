import { DEFAULT_VOCESPACE_CONFIG, VocespaceConfig } from '@/lib/std/conf';
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

// 暴露配置，给服务端使用，这样就可以在其他地方直接使用 STORED_CONF
export let STORED_CONF: VocespaceConfig = getConfig();

export const setStoredConf = (conf: VocespaceConfig) => {
  STORED_CONF = conf;
};