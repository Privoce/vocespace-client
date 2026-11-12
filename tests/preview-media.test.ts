// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  object: vi.fn(),
  principal: { id: 'session' } as object | null,
  job: { id: 'job' },
  exists: true,
}));
vi.mock('../services/api/lib/server/config', () => ({ getConfig: () => ({}) }));
vi.mock('../services/api/lib/server/host-authorization', () => ({ verifyHostToken: () => false }));
vi.mock('../services/api/lib/server/sessions', () => ({
  sessions: { read: async () => fake.principal },
}));
vi.mock('../services/api/native-auth', () => ({
  requireNative: async () => ({ token: 'token', principal: { id: 'session' } }),
}));
vi.mock('../services/api/preview/source', () => ({
  ensurePreview: async () => fake.job,
  previewObject: fake.object,
  validJob: async () => true,
  readJob: async () => fake.job,
  touchJob: async () => undefined,
  previewRedis: () => ({
    get: async () => JSON.stringify({ job: 'job', session: 'token', sessionId: 'session' }),
    set: async () => undefined,
    eval: async () => 1,
    exists: async () => fake.exists,
  }),
}));
import { nativePreviewEndpoint, previewMediaEndpoint } from '../services/api/native-preview';
import { ApiRequest } from '../services/api/http';
const id = 'b'.repeat(64);
const req = () =>
  new ApiRequest('https://meeting.invalid/api/v1/native/preview', {
    method: 'POST',
    body: '{"spaceName":"demo"}',
  });
beforeEach(() => {
  fake.principal = { id: 'session' };
  fake.exists = true;
  fake.object
    .mockReset()
    .mockResolvedValue(new TextEncoder().encode('#EXTM3U\n#EXTINF:2,\nsegment_00001.ts\n'));
});
it('reports missing HLS as starting but exposes storage failure as a retriable server error', async () => {
  fake.object.mockRejectedValueOnce({ name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
  expect(await (await nativePreviewEndpoint(req())).json()).toEqual({ status: 'starting' });
  fake.object.mockRejectedValueOnce({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
  await expect(nativePreviewEndpoint(req())).rejects.toMatchObject({
    status: 503,
    code: 'PREVIEW_STORAGE_UNAVAILABLE',
  });
});
it('returns a same-origin Platform URL for browser playback', async () => {
  const response = await nativePreviewEndpoint(req(), {
    token: 'cookie',
    principal: { id: 'session' } as any,
  });
  expect((await response.json()).url).toMatch(
    /^\/api\/platform\/preview\/media\/[a-f0-9]{64}\/live.m3u8$/,
  );
});
it('supports player HEAD probes and protects GET media with live membership checks', async () => {
  const request = new ApiRequest('https://meeting.invalid/api/preview/media', { method: 'HEAD' });
  const response = await previewMediaEndpoint(request, id, 'live.m3u8');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/vnd.apple.mpegurl');
  expect(await response.text()).toBe('');
  fake.principal = null;
  await expect(previewMediaEndpoint(request, id, 'live.m3u8')).rejects.toMatchObject({
    status: 410,
  });
});
it('rechecks revocation after storage I/O and never passes external segment URLs to a player', async () => {
  fake.object.mockImplementationOnce(async () => {
    fake.exists = false;
    return new Uint8Array([1]);
  });
  await expect(
    previewMediaEndpoint(new ApiRequest('https://meeting.invalid/media'), id, 'segment.ts'),
  ).rejects.toMatchObject({ status: 410 });
  fake.exists = true;
  fake.object.mockResolvedValue(
    new TextEncoder().encode('#EXTM3U\nhttps://evil.invalid/segment.ts\n'),
  );
  await expect(
    previewMediaEndpoint(new ApiRequest('https://meeting.invalid/media'), id, 'live.m3u8'),
  ).rejects.toThrow('INVALID_PREVIEW_ASSET');
});
