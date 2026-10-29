import { getConfig } from '../lib/server/config';
import { randomUUID } from 'node:crypto';
import {
  accountObject,
  accountAvatarUrl,
  accountString,
  parseAccountUser,
  parseAccountSpaces,
  type AccountSession,
  type AccountUser,
} from '@vocespace/contracts';
import { AccountError, type AccountProvider } from '@vocespace/server-core';
import type { SBTDeletionTarget, SBTSpaceTb, SBTUserInfo } from './supabase-types';
export interface SupabaseAccountConfig {
  url: string;
  key: string;
  serviceKey?: string;
}
export function accountConfig(): SupabaseAccountConfig {
  const { url, publishableKey: key, serviceRoleKey } = getConfig().account.supabase;
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
  return { url: url.replace(/\/$/, ''), key, serviceKey: serviceRoleKey };
}
export function createSupabaseAccountProvider(
  config: SupabaseAccountConfig,
  fetcher: typeof fetch = fetch,
): AccountProvider {
  async function call<T = unknown>(
    path: string,
    method = 'GET',
    body?: unknown,
    token?: string,
    admin = false,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
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
          ...extraHeaders,
        },
        body:
          body === undefined
            ? undefined
            : body instanceof Uint8Array
              ? Buffer.from(body)
              : JSON.stringify(body),
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
      if (code === 'otp_expired' || code === 'otp_disabled')
        throw new AccountError(400, 'AUTH_INVALID_CODE');
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
    // The transport type describes the selected columns, not runtime validation.
    // Consumers still validate untrusted responses before returning account DTOs.
    return data as T;
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
      avatar: accountAvatarUrl(metadata.avatar_url),
      email,
      nickname:
        typeof metadata.nickname === 'string' && metadata.nickname.trim()
          ? metadata.nickname.slice(0, 100)
          : email.split('@')[0],
    });
    if (!token) return parsed;
    // Existing platform profiles remain authoritative for display; RLS applies through the user's token.
    const profiles = await call<Pick<SBTUserInfo, 'nickname' | 'username' | 'avatar'>[]>(
      `/rest/v1/user_info?id=eq.${encodeURIComponent(parsed.id)}&select=nickname,username,avatar&limit=1`,
      'GET',
      undefined,
      token,
    );
    if (Array.isArray(profiles) && profiles[0]) {
      accountObject(profiles[0]);
      const profile = profiles[0];
      const nickname = profile.nickname || profile.username;
      parsed.avatar = accountAvatarUrl(profile.avatar) || parsed.avatar;
      if (typeof nickname === 'string' && nickname.trim()) parsed.nickname = nickname.slice(0, 100);
      if (typeof profile.username === 'string' && profile.username.trim())
        parsed.username = profile.username;
    }
    // The platform uses the verified email when no user_info username exists yet.
    parsed.username ||= email;
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
  async function ensureProfile(token: string, current: AccountUser) {
    // Ignore conflicts: never replace an existing username or other platform fields.
    await call(
      '/rest/v1/user_info?on_conflict=id',
      'POST',
      {
        id: current.id,
        username: current.username || current.email,
      } satisfies Pick<SBTUserInfo, 'id' | 'username'>,
      token,
      false,
      { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    );
  }
  return {
    async profile(token, current, nickname) {
      await ensureProfile(token, current);
      const rows = await call<Pick<SBTUserInfo, 'id' | 'nickname'>[]>(
        `/rest/v1/user_info?id=eq.${encodeURIComponent(current.id)}&select=id,nickname`,
        'PATCH',
        { nickname } satisfies Pick<SBTUserInfo, 'nickname'>,
        token,
        false,
        { Prefer: 'return=representation' },
      );
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        rows[0]?.id !== current.id ||
        rows[0]?.nickname !== nickname
      )
        throw new AccountError(502, 'PROFILE_UPDATE_FAILED');
      return { ...current, nickname };
    },
    verify: async (email, token, type) =>
      session(await call('/auth/v1/verify', 'POST', { email, token, type })),
    async resend(email) {
      await call('/auth/v1/resend', 'POST', { email, type: 'signup' });
    },
    login: async (email, password) =>
      session(await call('/auth/v1/token?grant_type=password', 'POST', { email, password })),
    async register(email, password, redirect, challenge) {
      const data = accountObject(
        await call(
          `/auth/v1/signup${redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''}`,
          'POST',
          {
            email,
            password,
            ...(challenge ? { code_challenge: challenge, code_challenge_method: 's256' } : {}),
          },
        ),
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
      await call(
        `/auth/v1/recover${redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : ''}`,
        'POST',
        {
          email,
          ...(challenge ? { code_challenge: challenge, code_challenge_method: 's256' } : {}),
        },
      );
    },
    exchange: async (auth_code, code_verifier) =>
      session(await call('/auth/v1/token?grant_type=pkce', 'POST', { auth_code, code_verifier })),
    async password(token, password) {
      await call('/auth/v1/user', 'PUT', { password }, token);
    },
    async avatar(token, current, bytes, type) {
      const ext = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
      }[type];
      if (!ext) throw new AccountError(400, 'AVATAR_INVALID_IMAGE');
      const path = `public/${current.id}_${Date.now()}_${randomUUID()}.${ext}`;
      const avatar = `${config.url}/storage/v1/object/public/avatars/${path}`;
      await call(`/storage/v1/object/avatars/${path}`, 'POST', bytes, token, false, {
        'Content-Type': type,
        'cache-control': 'max-age=3600',
        'x-upsert': 'false',
      });
      try {
        await ensureProfile(token, current);
        const rows = await call<Pick<SBTUserInfo, 'id'>[]>(
          `/rest/v1/user_info?id=eq.${encodeURIComponent(current.id)}&select=id`,
          'PATCH',
          { avatar } satisfies Pick<SBTUserInfo, 'avatar'>,
          token,
          false,
          { Prefer: 'return=representation' },
        );
        if (!Array.isArray(rows) || rows[0]?.id !== current.id)
          throw new AccountError(502, 'AVATAR_UPDATE_FAILED');
      } catch (error) {
        // A timeout may happen after the database committed. Keep that file rather than break the avatar.
        if (!(error instanceof AccountError && error.code === 'AUTH_UNAVAILABLE'))
          await call('/storage/v1/object/avatars', 'DELETE', { prefixes: [path] }, token).catch(
            () => undefined,
          );
        throw error;
      }
      // Only remove our own former avatar, after the profile update has succeeded.
      const prefix = `${config.url}/storage/v1/object/public/avatars/public/${current.id}_`;
      if (current.avatar?.startsWith(prefix)) {
        const name = current.avatar.slice(prefix.length);
        if (/^[a-zA-Z0-9_.-]+$/.test(name))
          await call(
            '/storage/v1/object/avatars',
            'DELETE',
            {
              prefixes: [`public/${current.id}_${name}`],
            },
            token,
          ).catch(() => undefined);
      }
      return { ...current, avatar };
    },
    async spaces(token, user) {
      const result = [];
      for (let offset = 0; ; offset += 100) {
        const rows = await call<Pick<SBTSpaceTb, 'id' | 'name' | 'url' | 'ty'>[]>(
          `/rest/v1/space?owner_id=eq.${encodeURIComponent(user.id)}&select=id,name,url,ty&order=id.asc&limit=100&offset=${offset}`,
          'GET',
          undefined,
          token,
        );
        if (!Array.isArray(rows)) throw new AccountError(502, 'AUTH_UNAVAILABLE');
        result.push(
          ...parseAccountSpaces(
            rows.map((row) => ({
              ...accountObject(row),
              kind: row?.ty || 'meeting',
            })),
          ),
        );
        if (rows.length < 100) return result;
      }
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
      ] satisfies SBTDeletionTarget[]) {
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
