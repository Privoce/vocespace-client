// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { parseNativeRoomDirectory } from '@vocespace/contracts';
import { DEFAULT_PARTICIPANT_SETTINGS } from '@vocespace/domain/space';
import { ApiRequest } from '../services/api/http';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), member: vi.fn(), get: vi.fn() }));
vi.mock('../services/api/native-auth', () => ({ requireNative: mocks.auth }));
vi.mock('../services/api/lib/server/native-chat', () => ({
  requireNativeChatMember: mocks.member,
}));
vi.mock('../services/api/lib/server/space-repository', () => ({
  spaceRepository: { get: mocks.get },
}));
vi.mock('../services/api/native-create', () => ({ nativeCreateEndpoint: vi.fn() }));
import { nativeRoomsEndpoint } from '../services/api/native-directory';
const avo = {
  name: 'Ada',
  variant: 810,
  hue: 193,
  style: 'ring',
  energy: 0.75,
  isUsed: true,
  enabled: true,
};
const participant = (name: string) => ({
  ...DEFAULT_PARTICIPANT_SETTINGS,
  name,
  avoList: [avo],
  sync: ['todo'],
  appDatas: {
    todo: [
      {
        date: 1,
        items: [
          { id: 'visible', title: 'Public task', visible: true },
          { id: 'hidden', title: 'Secret task', visible: false },
        ],
      },
    ],
  },
});
const request = () =>
  new ApiRequest('https://api.test/api/v1/native/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ joinId: 'directory-join-1234' }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ principal: { id: 'session' } });
  mocks.member.mockResolvedValue({ spaceName: 'space', roomName: 'space', identity: 'self' });
  mocks.get.mockResolvedValue({
    name: 'space',
    ownerId: 'self',
    managers: ['other'],
    apps: ['todo'],
    participants: {
      self: participant('Ada'),
      other: participant('Bob'),
      private: participant('Hidden'),
    },
    children: [
      { name: 'public', isPrivate: false, participants: ['other'] },
      { name: 'private', isPrivate: true, participants: ['private'] },
    ],
  });
});
it('projects full active AVO and roles, keeps private room members and hidden/cross-room tool data out', async () => {
  const result = parseNativeRoomDirectory(await (await nativeRoomsEndpoint(request())).json());
  expect(result.participants?.self.avo).toEqual(avo);
  expect(result.participants?.self.owner).toBe(true);
  expect(result.participants?.other.manager).toBe(true);
  expect(result.participants?.self.apps?.todo).toEqual([
    { id: 'visible', title: 'Public task', done: false },
  ]);
  expect(result.participants?.other.apps).toBeUndefined();
  expect(result.participants?.private).toBeUndefined();
  expect(result.rooms.map((room) => room.name)).toEqual(['space', 'public']);
});
it('selects the first preset when none is marked used and preserves disabled selection', async () => {
  const space = await mocks.get();
  space.participants.self.avoList = [{ ...avo, isUsed: false, enabled: false }];
  const result = parseNativeRoomDirectory(await (await nativeRoomsEndpoint(request())).json());
  expect(result.participants?.self.avo).toMatchObject({
    enabled: false,
    variant: 810,
    style: 'ring',
  });
});
it('discards stale data when membership is revoked during the read', async () => {
  mocks.member
    .mockResolvedValueOnce({ spaceName: 'space', roomName: 'space', identity: 'self' })
    .mockRejectedValueOnce(new Error('revoked'));
  await expect(nativeRoomsEndpoint(request())).rejects.toThrow('revoked');
});
it('rejects corrupt avatar and tool payloads instead of leaking arbitrary metadata', () => {
  const base = {
    current: 'space',
    rooms: [{ name: 'space', participantIds: ['self'] }],
    participants: { self: { name: 'Ada', status: 'online', owner: true, avo } },
  };
  for (const patch of [
    { style: 'unknown' },
    { energy: NaN },
    { hue: 999 },
    { variant: -1 },
    { enabled: 'true' },
  ])
    expect(() =>
      parseNativeRoomDirectory({
        ...base,
        participants: { self: { ...base.participants.self, avo: { ...avo, ...patch } } },
      }),
    ).toThrow();
  const parsed = parseNativeRoomDirectory({
    ...base,
    participants: {
      self: { ...base.participants.self, apps: { todo: [], secret: 'discard' }, secret: 'discard' },
    },
  });
  expect(parsed.participants?.self.apps).toEqual({ todo: [] });
  expect(JSON.stringify(parsed)).not.toContain('secret');
});

it('projects and validates hand state while retaining compatibility with old directories', async () => {
  const space = await mocks.get();
  space.participants.self.raiseHand = true;
  const result = parseNativeRoomDirectory(await (await nativeRoomsEndpoint(request())).json());
  expect(result.participants?.self.raiseHand).toBe(true);
  expect(result.participants?.other.raiseHand).toBe(false);
  const self = result.participants!.self;
  delete self.raiseHand;
  expect(parseNativeRoomDirectory(result).participants?.self.raiseHand).toBeUndefined();
  expect(() =>
    parseNativeRoomDirectory({ ...result, participants: { self: { ...self, raiseHand: 'true' } } }),
  ).toThrow();
});
