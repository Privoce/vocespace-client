import {
  DEFAULT_VOCESPACE_CONFIG,
  HyperbeamConf,
  isDefaultVocespaceConfig,
  mergeConf,
  ReadableConf,
  RTCConf,
  SMTPConf,
  VocespaceConfig,
} from '@/lib/std/conf';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const getConfigPath = () => join(process.cwd(), 'vocespace.conf.json');

export const hasConfigFile = (): boolean => {
  return existsSync(getConfigPath());
};

export const isConfigInitialized = (): boolean => {
  if (!hasConfigFile()) {
    return false;
  }

  return !isDefaultVocespaceConfig(getConfig());
};

export const getConfig = (): VocespaceConfig => {
  try {
    const configPath = getConfigPath();
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent) as VocespaceConfig;
    if (!config.roomLicenses) {
      config.roomLicenses = [];
    }
    if (!config.smtp) {
      config.smtp = DEFAULT_VOCESPACE_CONFIG.smtp;
    }
    if (!config.hyperbeam) {
      config.hyperbeam = DEFAULT_VOCESPACE_CONFIG.hyperbeam;
    }
    return config;
  } catch (error) {
    console.error('Error reading vocespace.conf.json:', error);
    return DEFAULT_VOCESPACE_CONFIG as VocespaceConfig;
  }
};

export const setConfigEnv = (
  env: RTCConf,
): {
  success: boolean;
  error?: Error;
} => {
  // 更新vocespace.conf.json
  let config: VocespaceConfig = getConfig();
  config.resolution = env.resolution;
  config.maxBitrate = env.maxBitrate;
  config.maxFramerate = env.maxFramerate;
  config.codec = env.codec;
  // 设置到文件中
  return writeBackConfig(config);
};

export const setConfigLicense = (license: string): { success: boolean; error?: Error } => {
  // 更新vocespace.conf.json
  let config: VocespaceConfig = getConfig();
  config.license = license;
  // 设置到文件中
  return writeBackConfig(config);
};

export const setConfigSMTP = (smtp: SMTPConf): { success: boolean; error?: Error } => {
  const config: VocespaceConfig = getConfig();
  config.smtp = smtp;
  return writeBackConfig(config);
};

export const setConfigHyperbeam = (
  hyperbeam: HyperbeamConf,
): { success: boolean; error?: Error } => {
  const config: VocespaceConfig = getConfig();
  config.hyperbeam = hyperbeam;
  return writeBackConfig(config);
};

export const setFullConfig = (config: VocespaceConfig): { success: boolean; error?: Error } => {
  return writeBackConfig(config);
};

export const setConfigRoomLicense = (license: string, roomName: string): { success: boolean; error?: Error } => {
  // 更新vocespace.conf.json
  let config: VocespaceConfig = getConfig();
  if (!config.roomLicenses) {
    config.roomLicenses = [];
  }
  // 如果已存在同名房间证书，替换；否则追加
  const idx = config.roomLicenses.findIndex((r) => r.name === roomName);
  if (idx >= 0) {
    config.roomLicenses[idx] = { name: roomName, license };
  } else {
    config.roomLicenses.push({ name: roomName, license });
  }
  // 设置到文件中
  return writeBackConfig(config);
};

export const writeBackConfig = (config: VocespaceConfig): { success: boolean; error?: Error } => {
  try {
    const configPath = getConfigPath();
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    setStoredConf(config);
    return {
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: e instanceof Error ? e : new Error('can not write back config'),
    };
  }
};

export interface AllowConfig {
  license?: string;
  rtc?: RTCConf;
}

export const setConfig = (allowConfig: AllowConfig) => {
  if (allowConfig.license) {
    setConfigLicense(allowConfig.license);
  }
  if (allowConfig.rtc) {
    setConfigEnv(allowConfig.rtc);
  }
};

// 暴露配置，给服务端使用，这样就可以在其他地方直接使用 STORED_CONF
export let STORED_CONF: VocespaceConfig = getConfig();

export const setStoredConf = (conf: ReadableConf) => {
  STORED_CONF = mergeConf(STORED_CONF, conf);
};
