import type { AnalyticsOperation } from '@vocespace/client-sdk';
import type { AnalyticsLeaveReason } from '@vocespace/contracts';
import { analytics } from './index';
let current:
  | {
      key: string;
      operation: AnalyticsOperation;
      creation?: AnalyticsOperation;
      joinedAt?: number;
      terminal?: boolean;
      reason?: AnalyticsLeaveReason;
    }
  | undefined;
/** The raw key is an in-memory lifecycle guard only, never an analytics property. */
export const webMeetingAnalytics = {
  begin(key: string, source = 'deep_link') {
    if (current?.key === key && !current.terminal) return;
    current = {
      key,
      operation: analytics.begin('space_join', { join_method: 'manual', target: 'main', source }),
    };
  },
  creating() {
    if (current && !current.creation && !current.joinedAt && !current.terminal)
      current.creation = analytics.begin('space_create', { space_type: 'meeting' });
  },
  created(created: boolean) {
    current?.creation?.end(created ? 'success' : 'cancelled');
  },
  confirmed(key: string) {
    if (!current || current.key !== key || current.terminal || current.joinedAt !== undefined)
      return;
    current.joinedAt = Date.now();
    current.operation.end('success');
  },
  fail(error: unknown, stage = 'connect') {
    if (!current || current.joinedAt !== undefined || current.terminal) return;
    current.operation.fail(error, { failure_stage: stage });
    current.creation?.fail(error);
    current.terminal = true;
  },
  reason(reason: AnalyticsLeaveReason) {
    if (current) current.reason = reason;
  },
  end(key: string, reason: AnalyticsLeaveReason = 'unknown') {
    if (!current || current.key !== key || current.terminal) return;
    current.terminal = true;
    if (current.joinedAt !== undefined)
      analytics.track('space_leave', {
        reason: current.reason || reason,
        duration_seconds: (Date.now() - current.joinedAt) / 1000,
      });
    else {
      current.operation.end('cancelled');
      current.creation?.end('cancelled');
    }
  },
};
