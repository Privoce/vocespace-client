// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  denied: false,
  handler: vi.fn(),
  files: JSON.stringify([{ id: 'board', mode: 'whiteboard', ownerId: 'owner' }]),
}));
vi.mock('../services/api/lib/server/config', () => ({
  getConfig: () => ({ deployment: { publicOrigin: 'https://meeting.invalid', basePath: '' } }),
}));
vi.mock('../services/api/lib/server/host-authorization', () => ({ verifyHostToken: () => false }));
vi.mock('../services/api/lib/server/sessions', () => ({
  sessions: { read: async () => ({ id: 'session', client: 'native' }) },
}));
vi.mock('../services/api/account/flow-store', () => ({
  accountFlows: { allow: async () => true },
}));
vi.mock('../services/api/lib/server/native-chat', () => ({
  requireNativeChatMember: async () => {
    if (state.denied) throw Object.assign(new Error(), { status: 403 });
    return { spaceName: 'demo', roomName: 'public-child', identity: 'native_user' };
  },
}));
vi.mock('../services/api/lib/server/space-redis', () => ({
  getSpaceRedisClient: () => ({ set: async () => undefined }),
}));
vi.mock('../services/api/handlers/upload', () => ({ POST: state.handler }));
vi.mock('node:fs/promises', () => ({ readFile: async () => state.files }));
import { nativeToolsEndpoint } from '../services/api/native-tools';
import { ApiRequest, ApiResponse } from '../services/api/http';
const req = (body: object) =>
  new ApiRequest('https://meeting.invalid/api/v1/native/tools', {
    method: 'POST',
    headers: { authorization: `Bearer ${'a'.repeat(64)}`, 'content-type': 'application/json' },
    body: JSON.stringify({ joinId: '12345678-1234-1234-1234-123456789abc', ...body }),
  });
beforeEach(() => {
  state.denied = false;
  state.handler.mockReset().mockResolvedValue(ApiResponse.json({ success: true }));
});
it('derives Space, public child and sender, rejecting client overrides', async () => {
  await nativeToolsEndpoint(
    req({
      action: 'set_meta',
      url: 'https://example.org',
      identity: 'owner',
      spaceName: 'private',
      room: 'private-room',
    }),
  );
  expect(await state.handler.mock.calls[0][0].json()).toEqual({
    ty: 'set_meta',
    iframeUrl: 'https://example.org',
    spaceName: 'demo',
    room: 'public-child',
    identity: 'native_user',
  });
});
it('rejects browser transport and unconfirmed membership before invoking legacy writes', async () => {
  const input = req({ action: 'create_whiteboard' });
  input.headers.set('origin', 'https://meeting.invalid');
  await expect(nativeToolsEndpoint(input)).rejects.toMatchObject({ status: 403 });
  state.denied = true;
  await expect(nativeToolsEndpoint(req({ action: 'create_whiteboard' }))).rejects.toMatchObject({
    status: 403,
  });
  expect(state.handler).not.toHaveBeenCalled();
});
it('does not expose arbitrary legacy actions or active-content URLs', async () => {
  for (const body of [
    { action: 'rm' },
    { action: 'set_meta', url: 'javascript:alert(1)' },
    { action: 'set_meta', url: 'https://user:pass@example.org' },
  ])
    await expect(nativeToolsEndpoint(req(body))).rejects.toMatchObject({ status: 400 });
  expect(state.handler).not.toHaveBeenCalled();
});
it('requires an existing whiteboard and bounded valid drawing input', async () => {
  await expect(
    nativeToolsEndpoint(
      req({ action: 'whiteboard', playerId: 'unknown', handWriting: { strokes: [] } }),
    ),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    nativeToolsEndpoint(
      req({ action: 'whiteboard', playerId: 'board', handWriting: { strokes: [null] } }),
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(
    (
      await nativeToolsEndpoint(
        req({ action: 'whiteboard', playerId: 'board', handWriting: { strokes: [] } }),
      )
    ).status,
  ).toBe(200);
});
