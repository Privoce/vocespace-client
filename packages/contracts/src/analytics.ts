/** Product analytics is separate from account, Redis and RTC identities. */
export const analyticsEvents = [
  'account_login',
  'account_register',
  'account_password_reset',
  'account_delete',
  'space_create',
  'space_preview',
  'space_join',
  'space_leave',
  'media_change',
  'room_switch',
  'space_share',
  'chat_send',
  'feedback_submit',
  'member_block',
] as const;
export type AnalyticsEvent = (typeof analyticsEvents)[number];
export const analyticsPages = {
  home: '/home',
  new_space: '/new_space',
  meetings_mine: '/meetings/mine',
  meetings_plaza: '/meetings/plaza',
  conference: '/space/:space',
  profile: '/profile',
  login: '/login',
  register: '/register',
  forgot_password: '/forgot-password',
  reset_password: '/account/reset-password',
  delete_account: '/deleteAccount',
  feedback: '/feedback',
  about: '/about',
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  dashboard: '/dashboard',
  unknown: '/other',
} as const;
export type AnalyticsPage = keyof typeof analyticsPages;
export type AnalyticsData = Record<string, string | number | boolean>;
export type AnalyticsSource =
  | 'home'
  | 'my_spaces'
  | 'plaza'
  | 'profile'
  | 'meeting'
  | 'deep_link'
  | 'delete_account'
  | 'room_switch'
  | 'unknown';
export type AnalyticsLeaveReason =
  | 'user'
  | 'browse'
  | 'background'
  | 'disconnected'
  | 'blocked'
  | 'unknown';
export interface AnalyticsPayload {
  website: string;
  hostname: string;
  url: string;
  title: string;
  referrer: string;
  language: string;
  name?: AnalyticsEvent;
  data: AnalyticsData;
}
const enums: Record<string, readonly string[]> = {
  platform: ['web', 'ios', 'android'],
  layout: ['pc', 'phone'],
  language: ['zh-CN', 'en-US', 'ru-RU'],
  auth_state: ['guest', 'signed_in', 'unknown'],
  page: Object.keys(analyticsPages),
  source: [
    'home',
    'my_spaces',
    'plaza',
    'profile',
    'meeting',
    'deep_link',
    'delete_account',
    'room_switch',
    'unknown',
  ],
  phase: ['attempt', 'success', 'failure', 'cancelled', 'playing', 'ended'],
  method: ['email_password', 'copy_link', 'system_share'],
  step: ['send_code', 'resend_code', 'verify', 'reset'],
  space_type: ['meeting'],
  end_reason: ['swipe', 'join', 'background', 'tab_change', 'error'],
  join_method: ['manual', 'auto'],
  target: ['main', 'child'],
  failure_stage: ['session', 'create', 'prepare', 'connect', 'confirm', 'settings'],
  reason: ['user', 'browse', 'background', 'disconnected', 'blocked', 'unknown'],
  media_type: ['microphone', 'camera', 'screen'],
  action: ['enable', 'disable'],
  from_type: ['main', 'child'],
  to_type: ['main', 'child'],
  result: ['success', 'opened', 'cancelled', 'failure'],
  scope: ['main', 'child'],
  message_type: ['text', 'file'],
  variant: ['feedback', 'report'],
  actor_role: ['owner', 'admin'],
  category: ['bug', 'error', 'question', 'suggestion', 'other'],
  error_code: [
    'network',
    'timeout',
    'service_unavailable',
    'invalid_credentials',
    'invalid_code',
    'rate_limited',
    'permission_denied',
    'blocked',
    'not_found',
    'media_failed',
    'unknown',
  ],
};
const common = [
  'schema_version',
  'platform',
  'layout',
  'app_version',
  'language',
  'auth_state',
  'page',
  'source',
  'error_code',
  'elapsed_ms',
];
const fields: Record<AnalyticsEvent, string[]> = {
  account_login: ['phase', 'method', 'remember_me'],
  account_register: ['phase', 'step'],
  account_password_reset: ['phase', 'step'],
  account_delete: ['phase'],
  space_create: ['phase', 'space_type'],
  space_preview: ['phase', 'valid_play_seconds', 'end_reason'],
  space_join: ['phase', 'join_method', 'target', 'failure_stage'],
  space_leave: ['reason', 'duration_seconds'],
  media_change: ['phase', 'media_type', 'action'],
  room_switch: ['phase', 'from_type', 'to_type'],
  space_share: ['method', 'result'],
  chat_send: ['phase', 'scope', 'message_type'],
  feedback_submit: ['phase', 'variant', 'has_attachment', 'category'],
  member_block: ['phase', 'actor_role'],
};
/** Reconstruct the payload instead of deleting known sensitive keys from arbitrary objects. */
export function sanitizeAnalytics(
  event: AnalyticsEvent | undefined,
  input: Record<string, unknown>,
): AnalyticsData {
  const output: AnalyticsData = { schema_version: 1 };
  for (const key of [...common, ...(event ? fields[event] || [] : [])]) {
    const value = input[key];
    if (enums[key] && typeof value === 'string' && enums[key].includes(value)) output[key] = value;
    else if (['remember_me', 'has_attachment'].includes(key) && typeof value === 'boolean')
      output[key] = value;
    else if (
      ['elapsed_ms', 'valid_play_seconds', 'duration_seconds'].includes(key) &&
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0
    )
      output[key] = Math.min(Math.round(value), 604800000);
    else if (
      key === 'app_version' &&
      typeof value === 'string' &&
      /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]{1,24})?$/.test(value)
    )
      output[key] = value;
  }
  return output;
}
export function analyticsLanguage(locale: string = 'en'): string {
  return locale.startsWith('zh') ? 'zh-CN' : locale.startsWith('ru') ? 'ru-RU' : 'en-US';
}
export function analyticsError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unknown';
  const { code, status, name, cause } = error as {
    code?: unknown;
    status?: unknown;
    name?: unknown;
    cause?: unknown;
  };
  if (cause && cause !== error) return analyticsErrorCode(cause);
  return analyticsErrorCode({ code, status, name });
}
function analyticsErrorCode(error: unknown): string {
  const { code, status, name } = (error || {}) as {
    code?: unknown;
    status?: unknown;
    name?: unknown;
  };
  if (name === 'TimeoutError' || code === 'TIMEOUT') return 'timeout';
  if (name === 'NotAllowedError' || status === 403)
    return ['SPACE_BLOCKED', 'SPACE_BLACKLISTED'].includes(String(code))
      ? 'blocked'
      : 'permission_denied';
  if (code === 'AUTH_INVALID_CREDENTIALS') return 'invalid_credentials';
  if (code === 'AUTH_INVALID_CODE') return 'invalid_code';
  if (status === 429 || code === 'AUTH_RATE_LIMITED') return 'rate_limited';
  if (status === 404) return 'not_found';
  if (typeof status === 'number' && status >= 500) return 'service_unavailable';
  if (name === 'NotReadableError' || name === 'NotFoundError') return 'media_failed';
  if (name === 'TypeError') return 'network';
  return 'unknown';
}
export function webAnalyticsPage(pathname: string, basePath = ''): AnalyticsPage | undefined {
  let route = pathname.split(/[?#]/)[0];
  if (basePath && (route === basePath || route.startsWith(`${basePath}/`)))
    route = route.slice(basePath.length) || '/';
  if (
    route.startsWith('/api') ||
    route.startsWith('/labs') ||
    route === '/tests' ||
    route.startsWith('/tests/') ||
    route.startsWith('/_next')
  )
    return undefined;
  if (route === '/') return undefined; // redirect to new_space, not a second landing page
  const known = Object.entries(analyticsPages).find(([, value]) => value === route);
  if (known) return known[0] as AnalyticsPage;
  if (route.startsWith('/dashboard')) return 'dashboard';
  return /^\/[^/]+\/?$/.test(route) ? 'conference' : 'unknown';
}
