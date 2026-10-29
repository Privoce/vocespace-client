import type { PublicClientConf } from '@vocespace/domain/config';
import defaults from '@vocespace/domain/runtime-defaults.json';
declare const __VOCESPACE_BASE_PATH__: string;
export const basePath = typeof __VOCESPACE_BASE_PATH__ === 'string' ? __VOCESPACE_BASE_PATH__ : '';
export function publicConfig(): PublicClientConf {
  if (typeof window !== 'undefined') {
    const value = (window as Window & { __VOCESPACE_CONFIG__?: PublicClientConf }).__VOCESPACE_CONFIG__;
    if (value) return value;
  }
  return { basePath, mobile: defaults.deployment.mobile, analytics: defaults.analytics, debug: defaults.debug };
}
