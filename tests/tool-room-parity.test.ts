// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ identity: 'native_user', room: 'demo' }));
vi.mock('../services/api/account/flow-store', () => ({
  accountFlows: { allow: async () => true },
}));
vi.mock('../services/api/lib/server/config', () => ({
  getConfig: () => ({ deployment: { publicOrigin: 'https://meeting.invalid', basePath: '' } }),
}));
vi.mock('../services/api/lib/server/host-authorization', () => ({ verifyHostToken: () => false }));
vi.mock('../services/api/lib/server/sessions', () => ({
  sessions: {
    read: async () => ({ id: 'session', client: 'native', identities: { demo: state.identity } }),
  },
  sessionToken: () => 'a'.repeat(64),
}));
vi.mock('../services/api/lib/server/space-repository', () => ({
  spaceRepository: {
    get: async () => ({ participants: { [state.identity]: {} }, managers: [], ownerId: 'owner' }),
  },
}));
vi.mock('../services/api/lib/server/native-chat', () => ({
  requireNativeChatMember: async () => ({
    spaceName: 'demo',
    roomName: state.room,
    identity: state.identity,
  }),
}));
vi.mock('../services/api/lib/server/space-redis', () => ({
  getSpaceRedisClient: () => ({ set: async () => undefined }),
}));
import { nativeToolsEndpoint } from '../services/api/native-tools';
import { POST as upload } from '../services/api/handlers/upload';
import { ApiRequest } from '../services/api/http';
import { tilePlayerDirectory } from '../services/api/lib/server/tile-player-directory';
const joinId = '12345678-1234-1234-1234-123456789abc';
function req(url: string, body: object | FormData) {
  return new ApiRequest(`https://meeting.invalid/${url}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${'a'.repeat(64)}`,
      ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }),
    },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}
const native = (body: object) =>
  nativeToolsEndpoint(req('api/v1/native/tools', { joinId, ...body }));
const webList = () =>
  upload(req('api/upload?tilePlayer=true', { ty: 'ls', spaceName: 'demo', room: 'demo' }));
let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'tool-parity-'));
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  state.identity = 'native_user';
  state.room = 'demo';
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});
it('shares Native images and iframes with Web in the main room and isolates child rooms', async () => {
  const form = new FormData();
  form.set('action', 'upload');
  form.set('joinId', joinId);
  form.set('file', new File(['image'], 'photo.png', { type: 'image/png' }));
  expect((await nativeToolsEndpoint(req('api/v1/native/tools', form))).status).toBe(200);
  await native({ action: 'set_meta', url: 'https://example.org' });
  const { players } = await (await webList()).json();
  expect(players.map((p: { mode: string }) => p.mode)).toEqual(['image', 'iframe']);
  expect(players[0].url).toMatch(/^\/uploads\/demo\/tile_player_/);
  state.room = 'child';
  expect(await (await native({ action: 'ls' })).json()).toEqual({ players: [] });
});
it('reopens the current whiteboard and lets only its owner remove it', async () => {
  const first = await (await native({ action: 'create_whiteboard' })).json();
  const again = await (await native({ action: 'create_whiteboard' })).json();
  expect(again.players).toEqual(first.players);
  expect(first.players).toHaveLength(1);
  expect(first.players[0].canRemove).toBe(true);
  state.identity = 'other';
  expect((await native({ action: 'rm', playerId: first.players[0].id })).status).toBe(403);
  state.identity = 'native_user';
  expect(await (await native({ action: 'rm', playerId: first.players[0].id })).json()).toEqual({
    players: [],
  });
});
it('merges both historic main-room directories once, preserving image data and child records', async () => {
  const dir = path.join(root, 'uploads/demo');
  await mkdir(path.join(dir, 'demo'), { recursive: true });
  await mkdir(path.join(dir, 'child'), { recursive: true });
  await writeFile(
    path.join(dir, 'tile_players.json'),
    JSON.stringify([{ id: 'native', mode: 'iframe' }]),
  );
  await writeFile(
    path.join(dir, 'demo/tile_players.json'),
    JSON.stringify([{ id: 'web', mode: 'image', fileName: 'photo.png' }]),
  );
  await writeFile(path.join(dir, 'demo/photo.png'), 'pixels');
  await writeFile(path.join(dir, 'child/tile_players.json'), '[]');
  await Promise.all([tilePlayerDirectory('demo', 'demo'), tilePlayerDirectory('demo')]);
  expect(
    JSON.parse(await readFile(path.join(dir, 'tile_players.json'), 'utf8')).map(
      (p: { id: string }) => p.id,
    ),
  ).toEqual(['native', 'web']);
  expect(await readFile(path.join(dir, 'photo.png'), 'utf8')).toBe('pixels');
  expect(await readFile(path.join(dir, 'demo/photo.png'), 'utf8')).toBe('pixels');
  expect(await readFile(path.join(dir, 'child/tile_players.json'), 'utf8')).toBe('[]');
  await tilePlayerDirectory('demo');
  expect(JSON.parse(await readFile(path.join(dir, 'tile_players.json'), 'utf8'))).toHaveLength(2);
});
