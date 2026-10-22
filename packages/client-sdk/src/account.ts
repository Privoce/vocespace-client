import {
  parseAccountUser,
  parseAccountSession,
  parseAccountRegistration,
} from '@vocespace/contracts';
import { ApiError, type ClientOptions } from './client';
/** Separate from the meeting bearer. Account tokens cannot silently become RTC credentials. */
export function createAccountClient(options: ClientOptions) {
  const base = new URL(options.baseUrl);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error('Invalid API URL');
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/`;
  async function request(action: string, body: unknown = {}, token?: string) {
    const response = await options.fetch(new URL(`api/v1/account/${action}`, base).toString(), {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      throw new ApiError(
        response.status,
        typeof error.code === 'string' ? error.code : 'AUTH_UNAVAILABLE',
        'Account request failed',
      );
    }
    return value;
  }
  return {
    async login(email: string, password: string) {
      return parseAccountSession(await request('login', { email, password }));
    },
    async register(email: string, password: string) {
      return parseAccountRegistration(await request('register', { email, password }));
    },
    async refresh(refreshToken: string) {
      return parseAccountSession(await request('refresh', { refreshToken }));
    },
    async me(token: string) {
      return parseAccountUser(await request('me', {}, token));
    },
    async logout(token: string) {
      await request('logout', {}, token);
    },
    async forgot(email: string) {
      await request('forgot-password', { email });
    },
    async remove(token: string, password: string) {
      await request('delete', { password, confirm: 'DELETE' }, token);
    },
  };
}
