// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  data: new Map<string, string>(),
  files: new Map<string, Uint8Array>(),
  denied: false,
  revoked: false,
  writes: 0,
}));
vi.mock('../services/api/lib/server/config', () => ({
  getConfig: () => ({ deployment: { publicOrigin: 'https://meeting.invalid', basePath: '' } }),
}));
vi.mock('../services/api/lib/server/host-authorization', () => ({ verifyHostToken: () => false }));
vi.mock('../services/api/lib/server/sessions', () => ({
  sessions: {
    read: async (token: string) =>
      token === 'a'.repeat(64) && !state.revoked ? { id: 'session', client: 'native' } : null,
  },
  sessionToken: () => undefined,
}));
vi.mock('../services/api/lib/server/native-chat', () => ({
  requireNativeChatMember: async () => {
    if (state.denied) throw Object.assign(new Error('DENIED'), { status: 403 });
    return { spaceName: 'demo', roomName: 'demo', identity: 'native_user' };
  },
}));
vi.mock('../services/api/lib/server/space-repository', () => ({
  spaceRepository: { get: async () => ({ participants: { native_user: { name: 'Trusted' } } }) },
}));
vi.mock('../services/api/lib/server/space-redis', () => ({
  getSpaceRedisClient: () => ({
    get: async (key: string) => state.data.get(key),
    exists: async (key: string) => Number(state.data.has(key)),
    set: async (key: string, value: string) => {
      state.data.set(key, value);
    },
    eval: async (_script: string, _count: number, chat: string, dedup: string, message: string) => {
      if (state.data.has(dedup)) return 0;
      state.data.set(chat, message);
      state.data.set(dedup, '1');
      return 1;
    },
  }),
}));
vi.mock('node:fs/promises', () => ({
  mkdir: async () => undefined,
  readdir: async () => [
    { name: 'report.pdf', isFile: () => true },
    { name: 'tile_players.json', isFile: () => true },
    { name: 'private-room', isFile: () => false },
  ],
  lstat: async (p: string) => ({ isFile: () => state.files.has(p), isSymbolicLink: () => false }),
  writeFile: async (p: string, bytes: Uint8Array) => {
    state.writes++;
    state.files.set(p, bytes);
  },
  readFile: async (p: string) => state.files.get(p),
  unlink: async (p: string) => state.files.delete(p),
}));
import { nativeFilesEndpoint, nativeFileDownload } from '../services/api/native-files';
import { ApiRequest } from '../services/api/http';
const joinId = '12345678-1234-1234-1234-123456789abc';
function request(body: object | FormData, headers = {}) {
  return new ApiRequest('https://meeting.invalid/api/v1/native/files', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${'a'.repeat(64)}`,
      ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body instanceof FormData ? body : JSON.stringify({ joinId, ...body }),
  });
}
function upload() {
  const form = new FormData();
  form.set('joinId', joinId);
  form.set('action', 'upload');
  form.set('id', joinId);
  form.set('identity', 'forged');
  form.set('file', new File(['hello'], 'report.pdf'));
  return request(form);
}
beforeEach(() => {
  state.data.clear();
  state.files.clear();
  state.denied = false;
  state.revoked = false;
  state.writes = 0;
});
it('rejects browser Origin even on multipart upload, before writing', async () => {
  const input = upload();
  input.headers.set('origin', 'https://evil.invalid');
  await expect(nativeFilesEndpoint(input)).rejects.toMatchObject({ status: 403 });
  expect(state.writes).toBe(0);
});
it('requires confirmed membership and rejects path traversal', async () => {
  state.denied = true;
  await expect(nativeFilesEndpoint(request({ action: 'list' }))).rejects.toMatchObject({
    status: 403,
  });
  state.denied = false;
  await expect(
    nativeFilesEndpoint(request({ action: 'download', name: '../secret' })),
  ).rejects.toMatchObject({ status: 400 });
});
it('lists only Space files, excluding tool metadata and child folders', async () => {
  expect(await (await nativeFilesEndpoint(request({ action: 'list' }))).json()).toEqual({
    files: ['report.pdf'],
  });
});
it('deduplicates concurrent sends and derives sender identity on the server', async () => {
  await Promise.all([nativeFilesEndpoint(upload()), nativeFilesEndpoint(upload())]);
  expect(state.writes).toBe(1);
  const message = JSON.parse(state.data.get('chat:demo')!);
  expect(message.sender).toEqual({ id: 'native_user', name: 'Trusted' });
  expect(message.file.url).toContain('native_user_');
});
it('download capabilities expire and recheck membership and session revocation', async () => {
  await nativeFilesEndpoint(upload());
  const name = `native_user_${joinId}.pdf`;
  const result = await (await nativeFilesEndpoint(request({ action: 'download', name }))).json();
  const id = result.url.split('/').pop();
  const req = new ApiRequest(result.url);
  expect((await nativeFileDownload(req, id)).headers.get('cache-control')).toBe(
    'private, no-store',
  );
  state.denied = true;
  await expect(nativeFileDownload(req, id)).rejects.toMatchObject({ status: 403 });
  state.denied = false;
  state.revoked = true;
  await expect(nativeFileDownload(req, id)).rejects.toMatchObject({ status: 403 });
  state.revoked = false;
  state.data.delete(`v1:native-file:${id}`);
  await expect(nativeFileDownload(req, id)).rejects.toMatchObject({ status: 410 });
});
