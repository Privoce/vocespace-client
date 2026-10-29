import { publicConfig } from '../runtime-config';
import { version } from '../../package.json';
import { createAnalytics } from '@vocespace/client-sdk';
import type { AnalyticsPayload } from '@vocespace/contracts';
const enabled = () =>
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'production' &&
  publicConfig().analytics.enabled;
let common: Record<string, unknown> = {
  platform: 'web',
  auth_state: 'unknown',
  language: 'en-US',
  app_version: version,
};
let queue: AnalyticsPayload[] = [];
let loaded = false;
type Tracker = { track(payload: AnalyticsPayload): Promise<unknown> | void };
const tracker = () => (window as Window & { umami?: Tracker }).umami;
export function setWebAnalyticsContext(value: Record<string, unknown>) {
  common = { ...common, ...value };
}
export function flushWebAnalytics() {
  if (!enabled() || !tracker()) return;
  loaded = true;
  const pending = queue;
  queue = [];
  for (const payload of pending) {
    try {
      void Promise.resolve(tracker()!.track(payload)).catch(() => undefined);
    } catch {
      /* A blocked tracker cannot break rendering. */
    }
  }
}
export const analytics = createAnalytics({
  enabled,
  now: Date.now,
  get website() { return publicConfig().analytics.websiteId; },
  hostname: 'vocespace.com',
  context: () => common,
  send: (payload) => {
    if (loaded && tracker()) return tracker()!.track(payload);
    if (queue.length < 50) queue.push(payload);
  },
});
export const webAnalyticsEnabled = enabled;
