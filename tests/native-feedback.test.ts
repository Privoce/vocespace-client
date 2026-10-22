// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), allow: vi.fn(), post: vi.fn() }));
vi.mock('../services/api/lib/server/sessions', () => ({
  sessions: { read: mocks.read },
  sessionToken: (headers: Headers) =>
    headers.get('cookie') === 'valid' ? 'verified-web-token' : undefined,
}));
vi.mock('../services/api/account/flow-store', () => ({ accountFlows: { allow: mocks.allow } }));
vi.mock('../services/api/handlers/feedback', () => ({ POST: mocks.post }));
vi.mock('../services/api/account/supabase', () => ({
  accountConfig: () => ({ url: 'https://supabase.example.test', serviceKey: 'test-server-secret' }),
}));
import { nativeFeedbackEndpoint, feedbackAccountEndpoint } from '../services/api/native-feedback';
import { ApiRequest } from '../services/api/http';
const id = '11111111-2222-3333-4444-555555555555';
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  mocks.read.mockResolvedValue({ id: 'native-session', client: 'native' });
  mocks.allow.mockResolvedValue(true);
  mocks.post.mockResolvedValue(Response.json({ success: true }));
});
it('reuses the feedback handler for authenticated Native multipart and rejects browser/anonymous requests', async () => {
  const data = new FormData();
  data.append('email', 'person@example.test');
  data.append('file', new File(['screenshot'], 'screen.png'));
  const request = new ApiRequest('https://api.example.test/api/v1/native/feedback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${'a'.repeat(64)}` },
    body: data,
  });
  expect((await nativeFeedbackEndpoint(request)).status).toBe(200);
  const forwarded = mocks.post.mock.calls[0][0] as ApiRequest;
  expect((await forwarded.formData()).get('file')).toBeInstanceOf(File);
  await expect(
    nativeFeedbackEndpoint(
      new ApiRequest(request.url, {
        method: 'POST',
        headers: { Origin: 'https://evil.test' },
        body: '{}',
      }),
    ),
  ).rejects.toMatchObject({ status: 403 });
  mocks.read.mockResolvedValue(undefined);
  await expect(
    nativeFeedbackEndpoint(
      new ApiRequest(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    ),
  ).rejects.toMatchObject({ status: 401 });
  expect(mocks.post).toHaveBeenCalledOnce();
});
it('fails closed when feedback rate limit is exceeded', async () => {
  mocks.allow.mockResolvedValue(false);
  await expect(
    nativeFeedbackEndpoint(
      new ApiRequest('https://api.example.test/api/v1/native/feedback', {
        method: 'POST',
        headers: { Authorization: `Bearer ${'a'.repeat(64)}`, 'Content-Type': 'application/json' },
        body: '{}',
      }),
    ),
  ).rejects.toMatchObject({ status: 429 });
  expect(mocks.post).not.toHaveBeenCalled();
});
it('selects email only from the server-verified platform identity, never a supplied UID', async () => {
  mocks.read.mockResolvedValue({ id: 'web-session', platform: { id } });
  const fetcher = vi.fn(async (_url: string) => Response.json({ id, email: 'account@example.test' }));
  vi.stubGlobal('fetch', fetcher);
  const response = await feedbackAccountEndpoint(
    new ApiRequest('https://app.example.test/api/v1/feedback/account?id=victim', {
      headers: { Cookie: 'valid' },
    }),
  );
  expect(await response.json()).toEqual({ email: 'account@example.test' });
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    `https://supabase.example.test/auth/v1/admin/users/${id}`,
  );
  mocks.read.mockResolvedValue(undefined);
  await expect(
    feedbackAccountEndpoint(new ApiRequest('https://app.example.test/api/v1/feedback/account')),
  ).rejects.toMatchObject({ status: 401 });
  expect(fetcher).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});
