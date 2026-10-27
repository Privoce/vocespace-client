import {
  parseAccountUser,
  parseAccountSpaces,
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
  async function request(action: string, body: unknown = {}, token?: string, file?: FormData) {
    const response = await options.fetch(new URL(`api/v1/account/${action}`, base).toString(), {
      method: 'POST',
      credentials: 'omit',
      headers: {
        ...(file ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file || JSON.stringify(body),
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
    async sendRegistrationCode(email: string, password: string, resend = false) {
      await request(resend ? 'resend-registration' : 'registration-code', {
        email,
        ...(resend ? {} : { password }),
      });
    },
    async verifyRegistration(email: string, code: string) {
      return parseAccountSession(await request('verify-registration', { email, code }));
    },
    async resetCode(email: string, code: string, password: string) {
      await request('reset-code', { email, code, password });
    },
    async login(email: string, password: string) {
      return parseAccountSession(await request('login', { email, password }));
    },
    async register(email: string, password: string) {
      return parseAccountRegistration(await request('register', { email, password }));
    },
    async refresh(refreshToken: string) {
      return parseAccountSession(await request('refresh', { refreshToken }));
    },
    async avatar(token: string, file: FormData) {
      return parseAccountUser(await request('avatar', {}, token, file));
    },
    async profile(token: string, nickname: string) {
      return parseAccountUser(await request('profile', { nickname }, token));
    },
    async spaces(token: string) {
      return parseAccountSpaces(await request('spaces', {}, token));
    },
    async me(token: string) {
      return parseAccountUser(await request('me', {}, token));
    },
    async logout(token: string) {
      await request('logout', {}, token);
    },
    async forgot(email: string) {
      await request('forgot-password', { email, delivery: 'code' });
    },
    async remove(token: string, password: string) {
      await request('delete', { password, confirm: 'DELETE' }, token);
    },
  };
}
