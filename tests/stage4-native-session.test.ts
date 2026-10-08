// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { createSessionService } from '@vocespace/server-core';
import { randomBytes } from 'node:crypto';
import { ApiRequest } from '@/services/api/http';
const fixture = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('@/lib/server/sessions', () => ({
  sessions: createSessionService(
    {
      read: async (key) => fixture.values.get(key) || null,
      write: async (key, value) => {
        fixture.values.set(key, value);
      },
      remove: async (key) => {
        fixture.values.delete(key);
      },
      consume: async () => null,
    },
    () => randomBytes(32).toString('hex'),
  ),
}));
import { nativeSessionEndpoint } from '@/services/api/native-auth';
import { sessions } from '@/lib/server/sessions';
import { createNativeApi } from '../apps/mobile/src/api/session';
const request = (headers: Record<string, string> = {}, method = 'POST', body = {}) =>
  new ApiRequest('https://api.test/api/v1/session/native', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
beforeEach(() => fixture.values.clear());
it('creates a native bearer session without exposing or adopting a browser cookie', async () => {
  const browser = await sessions.create();
  const response = await nativeSessionEndpoint(
    request({ cookie: `vocespace_session=${browser.token}` }),
  );
  const native = await response.json();
  expect(native.accessToken).not.toBe(browser.token);
  expect(native.accessToken).toMatch(/^[a-f0-9]{64}$/);
  expect(response.headers.has('Set-Cookie')).toBe(false);
  expect((await sessions.read(native.accessToken))?.client).toBe('native');
});
it('rejects browser requests and prevents exchanging a Web principal for a native bearer', async () => {
  await expect(
    nativeSessionEndpoint(request({ origin: 'https://api.test' })),
  ).rejects.toMatchObject({ status: 403 });
  const browser = await sessions.create();
  await expect(
    nativeSessionEndpoint(request({ authorization: `Bearer ${browser.token}` })),
  ).rejects.toMatchObject({ status: 401 });
  await expect(
    nativeSessionEndpoint(request({}, 'POST', { identity: 'owner' })),
  ).rejects.toMatchObject({ status: 400 });
});
it('restores native identity and applies revocation without silent identity replacement', async () => {
  const fresh = await (await nativeSessionEndpoint(request())).json();
  const headers = { authorization: `Bearer ${fresh.accessToken}` };
  expect(await (await nativeSessionEndpoint(request(headers))).json()).toEqual(fresh);
  await nativeSessionEndpoint(request(headers, 'DELETE'));
  await expect(nativeSessionEndpoint(request(headers))).rejects.toMatchObject({ status: 401 });
});
it('single-flights credential restoration and sends credentials as Bearer, never Cookie', async () => {
  const credential = { accessToken: 'a'.repeat(64), expiresAt: Date.now() + 10000 };
  const store = {
    read: vi.fn(async () => JSON.stringify(credential)),
    write: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
  const fetcher = vi.fn(async (_url, init) => {
    expect(init.credentials).toBe('omit');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${credential.accessToken}`);
    return Response.json(credential);
  });
  const client = createNativeApi('https://api.test', store, fetcher);
  await Promise.all([client.ensureSession(), client.ensureSession()]);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(store.write).toHaveBeenCalledOnce();
});
it('replaces a revoked credential only during bootstrap, persisting the replacement', async () => {
  const old = { accessToken: 'a'.repeat(64), expiresAt: Date.now() + 10000 };
  const fresh = { ...old, accessToken: 'b'.repeat(64) };
  const store = {
    read: async () => JSON.stringify(old),
    write: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ code: 'SESSION_REQUIRED' }, { status: 401 }))
    .mockResolvedValueOnce(Response.json(fresh));
  const client = createNativeApi('https://api.test', store, fetcher);
  await client.ensureSession();
  expect(store.clear).toHaveBeenCalledOnce();
  expect(store.write).toHaveBeenCalledWith(JSON.stringify(fresh));
  expect(new Headers(fetcher.mock.calls[1][1].headers).has('Authorization')).toBe(false);
});
