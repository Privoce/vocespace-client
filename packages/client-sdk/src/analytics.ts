import {
  analyticsEvents,
  analyticsPages,
  sanitizeAnalytics,
  analyticsError,
  type AnalyticsEvent,
  type AnalyticsPage,
  type AnalyticsPayload,
} from '@vocespace/contracts';
export interface AnalyticsOperation {
  end(phase: 'success' | 'failure' | 'cancelled', extra?: Record<string, unknown>): void;
  fail(error: unknown, extra?: Record<string, unknown>): void;
}
/** No platform globals or business requests; adapters own enablement and transport. */
export function createAnalytics(ports: {
  enabled(): boolean;
  now(): number;
  website: string;
  hostname: string;
  send(payload: AnalyticsPayload): void | Promise<unknown>;
  context(): Record<string, unknown>;
}) {
  let page: AnalyticsPage = 'unknown';
  let lastPage: AnalyticsPage | undefined;
  let scopeEnabled = true;
  const context = () => {
    try {
      return { ...ports.context(), page };
    } catch {
      return { page };
    }
  };
  const now = () => {
    try {
      return ports.now();
    } catch {
      return 0;
    }
  };
  const send = (event: AnalyticsEvent | undefined, values: Record<string, unknown>) => {
    try {
      if (!scopeEnabled || !ports.enabled()) return;
      if (event && !analyticsEvents.includes(event)) return;
      const data = sanitizeAnalytics(event, values);
      const current = (data.page || page) as AnalyticsPage;
      const platform = data.platform;
      const url = (platform === 'web' ? '' : '/app') + analyticsPages[current];
      void Promise.resolve(
        ports.send({
          website: ports.website,
          hostname: ports.hostname,
          url,
          title: current === 'conference' ? 'Conference' : current,
          referrer: '',
          language: String(data.language || 'en-US'),
          ...(event ? { name: event } : {}),
          data,
        }),
      ).catch(() => undefined);
    } catch {
      /* Analytics must never change the result of a business operation. */
    }
  };
  const begin = (
    name: AnalyticsEvent,
    values: Record<string, unknown> = {},
  ): AnalyticsOperation => {
    const snapshot = { ...context(), ...values };
    const started = now();
    let finished = false;
    send(name, { ...snapshot, phase: 'attempt' });
    const end: AnalyticsOperation['end'] = (phase, extra = {}) => {
      if (finished) return;
      finished = true;
      send(name, { ...snapshot, ...extra, phase, elapsed_ms: now() - started });
    };
    return {
      end,
      fail: (error, extra) => end('failure', { ...extra, error_code: analyticsError(error) }),
    };
  };
  return {
    begin,
    page(next: AnalyticsPage) {
      page = next;
      if (lastPage === next) return;
      lastPage = next;
      send(undefined, context());
    },
    scope(enabled: boolean) {
      scopeEnabled = enabled;
      if (!enabled) lastPage = undefined;
    },
    track(name: AnalyticsEvent, values: Record<string, unknown> = {}) {
      send(name, { ...context(), ...values });
    },
    async run<T>(
      name: AnalyticsEvent,
      values: Record<string, unknown>,
      work: () => Promise<T>,
    ): Promise<T> {
      const operation = begin(name, values);
      try {
        const result = await work();
        operation.end('success');
        return result;
      } catch (error) {
        operation.fail(error);
        throw error;
      }
    },
  };
}
export type Analytics = ReturnType<typeof createAnalytics>;
