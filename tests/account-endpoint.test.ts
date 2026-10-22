// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  refresh: vi.fn(),
  user: vi.fn(),
  logout: vi.fn(),
  recover: vi.fn(),
  exchange: vi.fn(),
  password: vi.fn(),
  remove: vi.fn(),
  allow: vi.fn(),
  write: vi.fn(),
  take: vi.fn(),
}));
vi.mock('../services/api/account/supabase', () => ({
  accountConfig: () => ({}),
  createSupabaseAccountProvider: () => mocks,
}));
vi.mock('../services/api/account/flow-store', () => ({ accountFlows: mocks }));
import { accountEndpoint } from '../services/api/account/endpoint';
import { ApiRequest } from '../services/api/http';
const id = '11111111-2222-3333-4444-555555555555';
const user = { id, email: 'person@example.test', nickname: 'Person' };
const session = {
  accessToken: 'server-access-secret',
  refreshToken: 'server-refresh-secret',
  expiresAt: 9999999999999,
  user,
};
let store: Map<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  store = new Map();
  vi.stubEnv('ACCOUNT_PUBLIC_URL', 'https://app.example.test/base/');
  mocks.allow.mockResolvedValue(true);
  mocks.write.mockImplementation(async (key, value) => {
    store.set(key, value);
  });
  mocks.take.mockImplementation(async (key) => {
    const value = store.get(key);
    store.delete(key);
    return value;
  });
  mocks.login.mockResolvedValue(session);
  mocks.user.mockResolvedValue(user);
  mocks.exchange.mockResolvedValue(session);
  mocks.logout.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
function request(action: string, body: unknown, headers: Record<string, string> = {}) {
  return new ApiRequest(`https://api.example.test/api/v1/account/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
it('refuses browser origins on token-returning native endpoints', async () => {
  const response = await accountEndpoint(
    request('login', { email: user.email, password: 'password' }, { Origin: 'https://evil.test' }),
    'login',
  );
  expect(response.status).toBe(403);
  expect(mocks.login).not.toHaveBeenCalled();
});
it('never lets a caller supply a victim id without a verified bearer', async () => {
  const response = await accountEndpoint(
    request('delete', { id, confirm: 'DELETE', password: 'password' }),
    'delete',
  );
  expect(response.status).toBe(401);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it('limits requests before sending mail or calling Supabase', async () => {
  mocks.allow.mockResolvedValue(false);
  const response = await accountEndpoint(
    request('forgot-password', { email: user.email }),
    'forgot-password',
  );
  expect(response.status).toBe(429);
  expect(mocks.recover).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
});
it('creates PKCE recovery, uses a one-time HttpOnly cookie and never puts tokens in redirects', async () => {
  const sent = await accountEndpoint(
    request('forgot-password', { email: user.email }),
    'forgot-password',
  );
  expect(sent.status).toBe(200);
  const redirect = new URL(mocks.recover.mock.calls[0][1]);
  expect(redirect.origin).toBe('https://app.example.test');
  expect(redirect.pathname).toBe('/base/api/v1/account/callback');
  const state = redirect.searchParams.get('state')!;
  expect(JSON.stringify(await sent.json())).not.toContain(state);
  redirect.searchParams.set('code', 'one-use-code');
  const callback = await accountEndpoint(new ApiRequest(redirect), 'callback');
  expect(callback.status).toBe(303);
  expect(callback.headers.get('location')).toBe(
    'https://app.example.test/base/account/reset-password',
  );
  const cookie = callback.headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Strict');
  expect(cookie).toContain('Secure');
  expect(cookie).not.toContain('server-access-secret');
  expect(callback.headers.get('location')).not.toContain('secret');
  const replay = await accountEndpoint(new ApiRequest(redirect), 'callback');
  expect(replay.headers.get('location')).toContain('invalid=1');
  expect(mocks.exchange).toHaveBeenCalledOnce();
  const headers = {
    Cookie: cookie.split(';')[0],
    Origin: 'https://app.example.test',
    'X-Vocespace-Request': '1',
  };
  const rejected = await accountEndpoint(
    request(
      'reset-password',
      { password: 'new-password' },
      { ...headers, Origin: 'https://evil.test' },
    ),
    'reset-password',
  );
  expect(rejected.status).toBe(403);
  expect(mocks.password).not.toHaveBeenCalled();
  const reset = await accountEndpoint(
    request('reset-password', { password: 'new-password' }, headers),
    'reset-password',
  );
  expect(reset.status).toBe(200);
  expect(mocks.password).toHaveBeenCalledWith('server-access-secret', 'new-password');
  const again = await accountEndpoint(
    request('reset-password', { password: 'new-password' }, headers),
    'reset-password',
  );
  expect(again.status).toBe(401);
  expect(mocks.password).toHaveBeenCalledOnce();
});
it('signup confirmation does not grant a password-recovery capability', async () => {
  const state = 'a'.repeat(64);
  store.set(state, { verifier: 'pkce-verifier', kind: 'signup' });
  const response = await accountEndpoint(
    new ApiRequest(`https://api.example.test/api/v1/account/callback?state=${state}&code=code`),
    'callback',
  );
  expect(response.headers.get('location')).toContain('confirmed=1');
  expect(response.headers.has('set-cookie')).toBe(false);
  expect(store.size).toBe(0);
});
