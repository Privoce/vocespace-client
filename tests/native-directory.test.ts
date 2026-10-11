// @vitest-environment node
import { expect, it } from 'vitest';
import {
  parseNativeJoinRequest,
  parseNativeSpaces,
  parseNativeRoomDirectory,
} from '@vocespace/contracts';
it('validates controlled directory DTOs and strips non-public fields', () => {
  expect(
    parseNativeSpaces([{ name: 'test', participantCount: 2, roomCount: 3, secret: 'discard' }]),
  ).toEqual([{ name: 'test', participantCount: 2, roomCount: 3 }]);
  expect(() => parseNativeSpaces([{ name: 'test', participantCount: -1, roomCount: 3 }])).toThrow();
  expect(() =>
    parseNativeRoomDirectory({ current: 'private', rooms: [{ name: 'main', participantIds: [] }] }),
  ).toThrow();
  expect(() =>
    parseNativeRoomDirectory({ current: 'main', rooms: [{ name: 'main', participantIds: [1] }] }),
  ).toThrow();
});
it('validates optional child-room selection while preserving old manual join requests', () => {
  const request = { joinId: 'directory-join-1234', spaceName: 'test', nickname: 'Guest' };
  expect(parseNativeJoinRequest(request)).toEqual(request);
  expect(parseNativeJoinRequest({ ...request, childRoom: 'Meeting Room' }).childRoom).toBe(
    'Meeting Room',
  );
  expect(() => parseNativeJoinRequest({ ...request, childRoom: {} })).toThrow();
});

it('keeps the current meeting for short, returned or diagonal drags and commits only a dominant axis', async () => {
  const { navigationGesture } = await import('../apps/mobile/src/conference/navigation-gesture');
  expect(navigationGesture(-90, 10)).toEqual({ axis: 'room', direction: 1 });
  expect(navigationGesture(90, 10)).toEqual({ axis: 'room', direction: -1 });
  expect(navigationGesture(10, -120)).toEqual({ axis: 'space', direction: 1 });
  expect(navigationGesture(10, 120)).toEqual({ axis: 'space', direction: -1 });
  expect(navigationGesture(63, 0)).toBeUndefined();
  expect(navigationGesture(2, 3)).toBeUndefined();
  expect(navigationGesture(90, 90)).toBeUndefined();
});
