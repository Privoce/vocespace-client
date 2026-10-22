// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createAccountService, type AccountProvider } from '@vocespace/server-core';
import { createSupabaseAccountProvider } from '../services/api/account/supabase';
import { createAccountClient } from '../packages/client-sdk/src/account';
const id = '11111111-2222-3333-4444-555555555555';
const user = { id, email: 'person@example.test', nickname: 'Person' };
const session = { accessToken: 'access', refreshToken: 'refresh', expiresAt: 9999999999999, user };
function provider(): AccountProvider {
  return {
    login: vi.fn(async () => session),
    register: vi.fn(async () => ({ session: null, confirmationRequired: true })),
    refresh: vi.fn(async () => session),
    user: vi.fn(async () => user),
    logout: vi.fn(async () => {}),
    recover: vi.fn(async () => {}),
    exchange: vi.fn(async () => session),
    password: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
}
describe('account authorization', () => {
  it('normalizes email, keeps existing short passwords valid for login, and enforces registration strength', async () => {
    const port = provider();
    const service = createAccountService(port);
    await service.login({ email: ' Person@Example.Test ', password: 'old123' });
    expect(port.login).toHaveBeenCalledWith('person@example.test', 'old123');
    expect(() =>
      service.register({ email: user.email, password: 'short' }, 'url', 'challenge'),
    ).toThrow();
    await expect(
      service.register({ email: user.email, password: 'strong-password' }, 'url', 'challenge'),
    ).resolves.toEqual({ session: null, confirmationRequired: true });
  });
  it('requires confirmation and password verification, and ignores supplied victim IDs', async () => {
    const port = provider();
    const service = createAccountService(port);
    await expect(service.remove('token', { password: 'password' })).rejects.toMatchObject({
      code: 'DELETE_CONFIRMATION_REQUIRED',
    });
    expect(port.remove).not.toHaveBeenCalled();
    vi.mocked(port.login).mockRejectedValueOnce(new Error('Bad password'));
    await expect(
      service.remove('token', { confirm: 'DELETE', password: 'wrong' }),
    ).rejects.toThrow();
    expect(port.remove).not.toHaveBeenCalled();
    await service.remove('token', {
      confirm: 'DELETE',
      password: 'password',
      id: 'victim',
      email: 'victim@test.invalid',
    });
    expect(port.login).toHaveBeenLastCalledWith(user.email, 'password');
    expect(port.remove).toHaveBeenCalledExactlyOnceWith(user);
  });
  it('rejects mismatched reauthentication and still cleans up the temporary session', async () => {
    const port = provider();
    vi.mocked(port.login).mockResolvedValue({ ...session, user: { ...user, id: 'other' } });
    await expect(
      createAccountService(port).remove('token', { confirm: 'DELETE', password: 'password' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect(port.remove).not.toHaveBeenCalled();
    expect(port.logout).toHaveBeenCalledWith('access');
  });
  it('never resets a password for an unverified token', async () => {
    const port = provider();
    vi.mocked(port.user).mockRejectedValue(new Error('Expired'));
    await expect(
      createAccountService(port).reset('bad', { password: 'strong-password' }),
    ).rejects.toThrow();
    expect(port.password).not.toHaveBeenCalled();
  });
});
describe('Supabase adapter', () => {
  const config = {
    url: 'https://supabase.example.test',
    key: 'public-test-key',
    serviceKey: 'server-test-secret',
  };
  it('maps Supabase tokens without an extra profile request that could lose a rotated refresh token', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        access_token: 'access',
        refresh_token: 'rotated',
        expires_in: 3600,
        user: { id, email: user.email, user_metadata: { nickname: 'From metadata' } },
      }),
    );
    const result = await createSupabaseAccountProvider(config, fetcher).refresh('old-refresh');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.refreshToken).toBe('rotated');
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('server-test-secret');
  });
  it('uses verified /user and existing user_info for display; no JWT decode fallback', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id, email: user.email }))
      .mockResolvedValueOnce(Response.json([{ nickname: 'Existing nickname' }]));
    expect(await createSupabaseAccountProvider(config, fetcher).user('opaque')).toMatchObject({
      id,
      nickname: 'Existing nickname',
    });
    expect(fetcher.mock.calls[0][0]).toContain('/auth/v1/user');
    const denied = vi.fn(async () =>
      Response.json({ code: 'bad_jwt', message: 'do not expose' }, { status: 401 }),
    );
    await expect(
      createSupabaseAccountProvider(config, denied).user('forged'),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(denied).toHaveBeenCalledOnce();
  });
  it('deletes only UUID-prefixed files, uses owner_id for Spaces, and deletes Auth last', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/object/list/'))
        return Response.json([{ name: `${id}_one.png` }, { name: `someone_${id}_other.png` }]);
      return Response.json({});
    });
    await createSupabaseAccountProvider(config, fetcher as typeof fetch).remove(user);
    const calls = fetcher.mock.calls;
    expect(calls.filter(([url]) => url.includes('/rest/v1/space'))[0][0]).toContain(
      `owner_id=eq.${id}`,
    );
    for (const [url, init] of calls)
      if (url.includes('/object/') && !url.includes('/list/'))
        expect(JSON.parse(String(init?.body))).toEqual({ prefixes: [`public/${id}_one.png`] });
    expect(calls.at(-1)?.[0]).toBe(`${config.url}/auth/v1/admin/users/${id}`);
  });
  it('paginates storage cleanup without skipping files shifted by deletion', async () => {
    const remaining = Array.from({ length: 205 }, (_, i) => ({
      name: `${id}_${String(i).padStart(4, '0')}.png`,
    }));
    const deleted: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/list/avatars')) {
        const { offset, limit } = JSON.parse(String(init?.body));
        return Response.json(remaining.slice(offset, offset + limit));
      }
      if (url.endsWith('/object/avatars')) {
        const { prefixes } = JSON.parse(String(init?.body));
        deleted.push(...prefixes);
        for (let i = remaining.length - 1; i >= 0; i--)
          if (prefixes.includes(`public/${remaining[i].name}`)) remaining.splice(i, 1);
      }
      return Response.json(url.includes('/list/') ? [] : {});
    });
    await createSupabaseAccountProvider(config, fetcher as typeof fetch).remove(user);
    expect(remaining).toHaveLength(0);
    expect(new Set(deleted).size).toBe(205);
  });
  it('maps GoTrue error_code without leaking provider messages', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ error_code: 'email_not_confirmed', msg: 'private detail' }, { status: 400 }),
    );
    await expect(
      createSupabaseAccountProvider(config, fetcher).login(user.email, 'password'),
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_CONFIRMED', status: 403 });
  });
  it('stops on data cleanup failure without claiming Auth deletion succeeded', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes('/object/list/')
        ? Response.json([])
        : Response.json({ message: 'private database detail' }, { status: 500 }),
    );
    await expect(
      createSupabaseAccountProvider(config, fetcher as typeof fetch).remove(user),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DELETION_FAILED' });
    expect(fetcher.mock.calls.some(([url]) => url.includes('/admin/users/'))).toBe(false);
  });
  it('does not send administrative requests without a service key', async () => {
    const fetcher = vi.fn();
    await expect(
      createSupabaseAccountProvider({ ...config, serviceKey: undefined }, fetcher).remove(user),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DELETION_NOT_CONFIGURED' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
it('SDK uses fixed account endpoints, sends passwords in JSON and rejects malformed sessions', async () => {
  const fetcher = vi.fn(async () => Response.json(session));
  const api = createAccountClient({ baseUrl: 'https://app.example.test/base/', fetch: fetcher });
  await api.login(user.email, 'test-password');
  expect(fetcher.mock.calls[0]).toBeDefined();
  const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
  expect(calls[0][0]).toBe('https://app.example.test/base/api/v1/account/login');
  expect(calls[0][1].credentials).toBe('omit');
  expect(calls[0][1].body).toContain('test-password');
  const bad = createAccountClient({
    baseUrl: 'https://app.example.test',
    fetch: async () => Response.json({ user }),
  });
  await expect(bad.login(user.email, 'test-password')).rejects.toThrow();
});
