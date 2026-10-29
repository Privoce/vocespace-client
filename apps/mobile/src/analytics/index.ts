import { mobileConfig } from '../config';
import { Platform } from 'react-native';
import appConfig from '../../app.json';
const version = appConfig.expo.version;
import { createAnalytics } from '@vocespace/client-sdk';
import type { AnalyticsPayload } from '@vocespace/contracts';
const enabled = () =>
  typeof __DEV__ !== 'undefined' && !__DEV__ && mobileConfig.analytics.enabled;
const host = mobileConfig.analytics.url;
let common: Record<string, unknown> = {
  app_version: version,
  auth_state: 'unknown',
  language: 'en-US',
};
let cache: string | undefined;
let pending = Promise.resolve();
let size = 0;
export function setNativeAnalyticsContext(value: Record<string, unknown>) {
  common = { ...common, ...value };
}
async function send(payload: AnalyticsPayload) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/api/send`, {
      method: 'POST',
      signal: abort.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          Platform.OS === 'ios'
            ? `Mozilla/5.0 (iPhone; CPU iPhone OS ${String(Platform.Version)
                .replace(/[^0-9.]/g, '')
                .replace(/\./g, '_')} like Mac OS X) AppleWebKit/605.1.15 VoceSpace/${version}`
            : `Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 VoceSpace/${version}`,
        ...(cache ? { 'x-umami-cache': cache } : {}),
      },
      body: JSON.stringify({ type: 'event', payload }),
    });
    if (response.ok) {
      const result = await response.json();
      if (typeof result.cache === 'string' && result.cache.length < 4096) cache = result.cache;
    } else cache = undefined;
  } catch {
    cache = undefined;
  } finally {
    clearTimeout(timer);
  }
}
export const analytics = createAnalytics({
  enabled,
  now: Date.now,
  website: mobileConfig.analytics.websiteId,
  hostname: 'vocespace.app',
  context: () => ({ ...common, platform: Platform.OS }),
  send(payload) {
    if (size >= 30) return;
    size++;
    pending = pending
      .catch(() => undefined)
      .then(() => (enabled() ? send(payload) : undefined))
      .finally(() => {
        size--;
      });
  },
});
