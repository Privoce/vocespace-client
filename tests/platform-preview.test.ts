// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  session: undefined as any,
  read: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
  preview: vi.fn(),
}));
vi.mock('../services/api/lib/server/config', () => ({
  getConfig: () => ({ deployment: { platform: { publicOrigin: 'https://home.invalid' } } }),
}));
vi.mock('../services/api/lib/server/host-authorization', () => ({ verifyHostToken: () => false }));
vi.mock('../services/api/lib/server/sessions', () => ({
  sessions: { read: state.read, create: state.create, revoke: state.revoke },
  sessionToken: (h: Headers) => h.get('authorization') || h.get('cookie')?.split('=')[1],
  sessionCookie: (t: string) => `vocespace_session=${t}; HttpOnly; Secure; SameSite=Lax`,
}));
vi.mock('../services/api/account/flow-store', () => ({
  accountFlows: { allow: async () => true },
}));
vi.mock('../services/api/native-preview', () => ({ nativePreviewEndpoint: state.preview }));
vi.mock('../services/api/handlers/feedback', () => ({ POST: async () => new Response('{}') }));
import { platformPreviewEndpoint } from '../services/api/platform-preview';
import { ApiRequest, ApiResponse } from '../services/api/http';
const request = (headers = {}) =>
  new ApiRequest('http://api.invalid/api/platform/preview', {
    method: 'POST',
    headers: {
      origin: 'https://home.invalid',
      'x-vocespace-request': '1',
      'content-type': 'application/json',
      ...headers,
    },
    body: '{"spaceName":"demo"}',
  });
beforeEach(() => {
  state.read.mockReset().mockResolvedValue(null);
  state.create.mockReset().mockResolvedValue({ token: 'new-cookie', principal: { id: 'browser' } });
  state.preview.mockReset().mockResolvedValue(ApiResponse.json({ status: 'unavailable' }));
  state.revoke.mockReset();
});
it('rejects wrong origins and cross-site requests before creating sessions', async () => {
  for (const h of [
    { origin: 'https://evil.invalid' },
    { 'sec-fetch-site': 'cross-site' },
    { 'x-vocespace-request': '' },
  ])
    await expect(platformPreviewEndpoint(request(h), 'preview')).rejects.toMatchObject({
      status: 403,
    });
  expect(state.create).not.toHaveBeenCalled();
});
it('uses HttpOnly browser cookies and never forwards a Supabase bearer as Native identity', async () => {
  const response = await platformPreviewEndpoint(
    request({ authorization: 'Bearer account-token' }),
    'preview',
  );
  expect(state.read).toHaveBeenCalledWith(undefined);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(state.preview.mock.calls[0][1]).toEqual({
    token: 'new-cookie',
    principal: { id: 'browser' },
  });
});
it('rejects a Native principal provided via a cookie', async () => {
  state.read.mockResolvedValue({ id: 'native', client: 'native' });
  await expect(
    platformPreviewEndpoint(request({ cookie: 'vocespace_session=native-token' }), 'preview'),
  ).rejects.toMatchObject({ status: 403 });
  expect(state.preview).not.toHaveBeenCalled();
});
it('revokes an undelivered session when starting a preview fails', async () => {
  state.preview.mockRejectedValue(new Error('unavailable'));
  await expect(platformPreviewEndpoint(request(), 'preview')).rejects.toThrow('unavailable');
  expect(state.revoke).toHaveBeenCalledWith('new-cookie');
});
