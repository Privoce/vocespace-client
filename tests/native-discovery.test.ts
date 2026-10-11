// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_SPACE_INFO } from '../apps/web/lib/std/space';
import { parseNativeSpaces } from '@vocespace/contracts';
import { ApiRequest } from '../services/api/http';
const mocks = vi.hoisted(() => ({
  requireNative: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  member: vi.fn(),
}));
vi.mock('../services/api/native-auth', () => ({ requireNative: mocks.requireNative }));
vi.mock('../services/api/lib/server/native-chat', () => ({ requireNativeChatMember: mocks.member }));
vi.mock('../services/api/lib/server/space-repository', () => ({
  spaceRepository: { list: mocks.list, get: mocks.get },
}));
import { nativeSpacesEndpoint, nativeRoomsEndpoint } from '../services/api/native-directory';
const request = () => new ApiRequest('https://api.test/api/v1/native/spaces');
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireNative.mockResolvedValue({ principal: { id: 'native-session' } });
});
afterEach(() => vi.unstubAllEnvs());

it('discovers both Web-created spaces regardless of legacy env values and projects no private settings', async () => {
  vi.stubEnv('NATIVE_CONFERENCE_SPACE', 'mobile-test');
  vi.stubEnv('NATIVE_CONFERENCE_SPACES', 'unused');
  mocks.list.mockResolvedValue({
    'mobile-test': { ...DEFAULT_SPACE_INFO(1, true), license: 'not-public' },
    mobile1: DEFAULT_SPACE_INFO(1, true),
    restricted: { ...DEFAULT_SPACE_INFO(1, true), allowGuest: 'disable' },
    invitation: { ...DEFAULT_SPACE_INFO(1, true), allowGuest: 'link' },
  });
  const response = await nativeSpacesEndpoint(request());
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual([
    { name: 'mobile-test', participantCount: 0, roomCount: 3 },
    { name: 'mobile1', participantCount: 0, roomCount: 3 },
  ]);
});

it('does not silently truncate the registry at the old 100-space allowlist limit', async () => {
  mocks.list.mockResolvedValue(
    Object.fromEntries(
      Array.from({ length: 101 }, (_, i) => [`room-${i}`, DEFAULT_SPACE_INFO(1, true)]),
    ),
  );
  const response = await nativeSpacesEndpoint(request());
  expect(parseNativeSpaces(await response.json())).toHaveLength(101);
});

it('propagates discovery failures instead of displaying an empty successful list', async () => {
  mocks.list.mockRejectedValue(new Error('storage unavailable'));
  await expect(nativeSpacesEndpoint(request())).rejects.toThrow('storage unavailable');
});

it('requires the native session before reading the registry', async () => {
  mocks.requireNative.mockRejectedValue(new Error('session required'));
  await expect(nativeSpacesEndpoint(request())).rejects.toThrow('session required');
  expect(mocks.list).not.toHaveBeenCalled();
});

it('discovers a Space with private rooms but never returns their names or members in the room directory', async () => {
  const space = DEFAULT_SPACE_INFO(1, true);
  space.children.push({
    name: 'Private conversation',
    isPrivate: true,
    ownerId: 'owner',
    participants: ['secret-member'],
  });
  space.participants['secret-member'] = {} as never;
  mocks.list.mockResolvedValue({ meeting: space });
  mocks.get.mockResolvedValue(space);
  mocks.member.mockResolvedValue({ spaceName: 'meeting', roomName: 'meeting' });
  expect(await (await nativeSpacesEndpoint(request())).json()).toEqual([
    { name: 'meeting', participantCount: 1, roomCount: 3 },
  ]);
  const response = await nativeRoomsEndpoint(
    new ApiRequest('https://api.test/api/v1/native/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ joinId: 'directory-join-1234' }),
    }),
  );
  const directory = await response.json();
  expect(directory.rooms).toHaveLength(3);
  expect(JSON.stringify(directory)).not.toContain('Private conversation');
  expect(JSON.stringify(directory)).not.toContain('secret-member');
});
