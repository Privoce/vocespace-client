import {
  accountObject,
  accountString,
  parseAccountUser,
  type AccountSession,
  type AccountUser,
} from '@vocespace/contracts';
import { AccountError, type AccountProvider } from '@vocespace/server-core';
export interface SupabaseAccountConfig {
  url: string;
  key: string;
  serviceKey?: string;
}
export function accountConfig(): SupabaseAccountConfig {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;
  if (!url || !key) throw new AccountError(503, 'AUTH_NOT_CONFIGURED');
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new AccountError(503, 'AUTH_NOT_CONFIGURED');
  return { url: url.replace(/\/$/, ''), key, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY };
}
export function createSupabaseAccountProvider(
  config: SupabaseAccountConfig,
  fetcher: typeof fetch = fetch,
): AccountProvider {
  async function call(path: string, method = 'GET', body?: unknown, token?: string, admin = false) {
    const key = admin ? config.serviceKey : config.key;
    if (!key) throw new AccountError(503, 'ACCOUNT_DELETION_NOT_CONFIGURED');
    let response: Response;
    try {
      response = await fetcher(`${config.url}${path}`, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        headers: {
          apikey: key,
          ...(token || admin ? { Authorization: `Bearer ${admin ? key : token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new AccountError(503, 'AUTH_UNAVAILABLE');
    }
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const errorBody = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      const code = errorBody.error_code || errorBody.code;
      if (response.status === 429) throw new AccountError(429, 'AUTH_RATE_LIMITED');
      if (code === 'email_not_confirmed') throw new AccountError(403, 'EMAIL_NOT_CONFIRMED');
      if (code === 'weak_password') throw new AccountError(400, 'PASSWORD_TOO_WEAK');
      if (code === 'user_already_exists' || code === 'email_exists')
        throw new AccountError(409, 'EMAIL_ALREADY_REGISTERED');
      if (code === 'signup_disabled') throw new AccountError(403, 'REGISTRATION_DISABLED');
      if (admin) throw new AccountError(502, 'ACCOUNT_DELETION_FAILED');
      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403 ||
        response.status === 422
      )
        throw new AccountError(401, 'AUTH_INVALID_CREDENTIALS');
      throw new AccountError(503, 'AUTH_UNAVAILABLE');
    }
    return data;
  }
  async function user(value: unknown, token?: string): Promise<AccountUser> {
    const raw = accountObject(value);
    const email = accountString(raw.email, 254);
    const metadata =
      raw.user_metadata && typeof raw.user_metadata === 'object'
        ? (raw.user_metadata as Record<string, unknown>)
        : {};
    const parsed = parseAccountUser({
      id: raw.id,
      email,
      nickname:
        typeof metadata.nickname === 'string' && metadata.nickname.trim()
          ? metadata.nickname.slice(0, 100)
          : email.split('@')[0],
    });
    if (!token) return parsed;
    // Existing platform profiles remain authoritative for display; RLS applies through the user's token.
    const profiles = await call(
      `/rest/v1/user_info?id=eq.${encodeURIComponent(parsed.id)}&select=nickname,username&limit=1`,
      'GET',
      undefined,
      token,
    );
    if (Array.isArray(profiles) && profiles[0]) {
      const profile = accountObject(profiles[0]);
      const nickname = profile.nickname || profile.username;
      if (typeof nickname === 'string' && nickname.trim()) parsed.nickname = nickname.slice(0, 100);
    }
    return parsed;
  }
  async function session(value: unknown): Promise<AccountSession> {
    const data = accountObject(value);
    const accessToken = accountString(data.access_token, 16384);
    if (typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in))
      throw new AccountError(502, 'AUTH_INVALID_RESPONSE');
    return {
      accessToken,
      refreshToken: accountString(data.refresh_token),
      expiresAt: Date.now() + data.expires_in * 1000,
      user: await user(data.user),
    };
  }
  return {
    login: async (email, password) =>
      session(await call('/auth/v1/token?grant_type=password', 'POST', { email, password })),
    async register(email, password, redirect, challenge) {
      const data = accountObject(
        await call(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`, 'POST', {
          email,
          password,
          code_challenge: challenge,
          code_challenge_method: 's256',
        }),
      );
      return data.access_token
        ? { session: await session(data), confirmationRequired: false }
        : { session: null, confirmationRequired: true };
    },
    refresh: async (refresh_token) =>
      session(await call('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token })),
    user: async (token) => user(await call('/auth/v1/user', 'GET', undefined, token), token),
    async logout(token) {
      await call('/auth/v1/logout?scope=local', 'POST', {}, token);
    },
    async recover(email, redirect, challenge) {
      await call(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, 'POST', {
        email,
        code_challenge: challenge,
        code_challenge_method: 's256',
      });
    },
    exchange: async (auth_code, code_verifier) =>
      session(await call('/auth/v1/token?grant_type=pkce', 'POST', { auth_code, code_verifier })),
    async password(token, password) {
      await call('/auth/v1/user', 'PUT', { password }, token);
    },
    async remove(user) {
      if (!config.serviceKey) throw new AccountError(503, 'ACCOUNT_DELETION_NOT_CONFIGURED');
      // Match the existing platform's UUID-prefixed files, not arbitrary submitted paths.
      for (const bucket of ['avatars', 'ai_analysis']) {
        let offset = 0;
        for (;;) {
          const files = await call(
            `/storage/v1/object/list/${bucket}`,
            'POST',
            {
              prefix: 'public',
              search: `${user.id}_`,
              limit: 100,
              offset,
              sortBy: { column: 'name', order: 'asc' },
            },
            undefined,
            true,
          );
          if (!Array.isArray(files)) throw new AccountError(502, 'ACCOUNT_DELETION_FAILED');
          const names = files.flatMap((entry) => {
            const name = accountObject(entry).name;
            return typeof name === 'string' &&
              name.startsWith(`${user.id}_`) &&
              !name.includes('/') &&
              !name.includes('..')
              ? [`public/${name}`]
              : [];
          });
          if (names.length)
            await call(
              `/storage/v1/object/${bucket}`,
              'DELETE',
              { prefixes: names },
              undefined,
              true,
            );
          if (files.length < 100) break;
          offset += files.length - names.length;
        }
      }
      // Each deletion is scoped and idempotent; a failure stops before deleting Auth.
      for (const [table, column] of [
        ['space', 'owner_id'],
        ['todos', 'id'],
        ['ai_analysis', 'id'],
        ['user_info', 'id'],
      ]) {
        await call(
          `/rest/v1/${table}?${column}=eq.${encodeURIComponent(user.id)}`,
          'DELETE',
          undefined,
          undefined,
          true,
        );
      }
      await call(
        `/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
        'DELETE',
        {},
        undefined,
        true,
      );
    },
  };
}
