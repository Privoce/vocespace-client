// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_SPACE_INFO } from '@vocespace/domain/space';
import { parseNativeWidgetAction, parseNativeWidgets } from '@vocespace/contracts';
const state = vi.hoisted(() => ({ raw: '', denied: false, eval: vi.fn() }));
vi.mock('../services/api/lib/server/config', () => ({ getConfig: () => ({}) }));
vi.mock('../services/api/lib/server/host-authorization', () => ({ verifyHostToken: () => false }));
vi.mock('../services/api/native-auth', () => ({
  requireNative: async () => ({
    token: 'token',
    principal: { id: 'session', identities: { test: 'self' } },
  }),
}));
vi.mock('../services/api/lib/server/native-chat', () => ({
  requireNativeChatMember: async () => {
    if (state.denied) throw Object.assign(new Error('denied'), { status: 403 });
    return { spaceName: 'test', roomName: 'test', identity: 'self' };
  },
}));
vi.mock('../services/api/lib/server/space-redis', () => ({
  getSpaceRedisClient: () => ({
    get: async () => state.raw,
    eval: state.eval,
  }),
}));
vi.mock('../services/api/lib/server/space-repository', () => ({
  spaceRepository: {
    get: async () => JSON.parse(state.raw),
  },
}));
vi.mock('../services/api/account/flow-store', () => ({
  accountFlows: { allow: async () => true },
}));
import {
  applyWidgetAction,
  nativeWidgetsEndpoint,
  widgetSnapshot,
} from '../services/api/native-widgets';
import { ApiRequest } from '../services/api/http';

function fixture() {
  const info = DEFAULT_SPACE_INFO(0, false);
  info.apps = ['todo', 'timer', 'countdown'];
  info.participants = {
    self: {
      name: 'Self',
      sync: [],
      appDatas: {
        todo: [
          { date: 0, items: [{ id: '1', title: 'Own hidden task', visible: false, done: 1000 }] },
        ],
      },
    },
    other: {
      name: 'Other',
      sync: [],
      appDatas: {
        todo: [{ date: 0, items: [{ id: '2', title: 'Other secret', visible: false }] }],
      },
    },
  } as typeof info.participants;
  return info;
}
const req = (action?: unknown, extra = {}) =>
  new ApiRequest('https://example.invalid/api/v1/native/widgets', {
    method: action ? 'PUT' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ joinId: '12345678-1234-4234-8234-123456789abc', action, ...extra }),
  });
beforeEach(() => {
  state.raw = JSON.stringify(fixture());
  state.denied = false;
  state.eval.mockReset().mockResolvedValue(1);
});
it('returns own unshared widgets without exposing another participant', async () => {
  const result = await (await nativeWidgetsEndpoint(req())).json();
  expect(parseNativeWidgets(result).todo[0].items[0].title).toBe('Own hidden task');
  expect(JSON.stringify(result)).not.toContain('Other secret');
  expect(result.countdown.duration).toContain('00:05:00');
});
it('derives the write target from membership, ignoring identity supplied outside the action', async () => {
  await nativeWidgetsEndpoint(
    req({ kind: 'todo-add', id: '3', title: 'New' }, { identity: 'other' }),
  );
  const next = JSON.parse(state.eval.mock.calls[0][7]);
  expect(next.participants.other).toEqual(fixture().participants.other);
  expect(
    next.participants.self.appDatas.todo.flatMap((g: { items: unknown[] }) => g.items),
  ).toEqual(expect.arrayContaining([expect.objectContaining({ id: '3', title: 'New' })]));
});
it('rejects unconfirmed members and writes revoked during the atomic update', async () => {
  state.denied = true;
  await expect(
    nativeWidgetsEndpoint(req({ kind: 'sync', key: 'todo', visible: true })),
  ).rejects.toMatchObject({ status: 403 });
  expect(state.eval).not.toHaveBeenCalled();
  state.denied = false;
  state.eval.mockResolvedValue(-1);
  await expect(
    nativeWidgetsEndpoint(req({ kind: 'sync', key: 'todo', visible: true })),
  ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });
});
it('retries a conflicting write against the new Space without losing other changes', async () => {
  state.eval
    .mockImplementationOnce(async () => {
      const next = fixture();
      next.participants.other.name = 'Updated elsewhere';
      state.raw = JSON.stringify(next);
      return 0;
    })
    .mockResolvedValue(1);
  await nativeWidgetsEndpoint(req({ kind: 'sync', key: 'todo', visible: true }));
  expect(JSON.parse(state.eval.mock.calls[1][7]).participants.other.name).toBe('Updated elsewhere');
});
it('keeps completed history on deletion and makes repeated adds idempotent', () => {
  const info = fixture();
  applyWidgetAction(info, 'self', { kind: 'todo-add', id: '3', title: 'New' }, 10000);
  applyWidgetAction(info, 'self', { kind: 'todo-add', id: '3', title: 'New' }, 10001);
  applyWidgetAction(info, 'self', { kind: 'todo-done', id: '3', done: true }, 10002);
  applyWidgetAction(info, 'self', { kind: 'todo-delete', id: '3' }, 10003);
  const items = widgetSnapshot(info, 'self').todo.flatMap((group) => group.items);
  expect(items.filter((item) => item.id === '3')).toEqual([
    { id: '3', title: 'New', visible: false, done: 10002 },
  ]);
});
it('resumes countdown with the same remaining time and blocks disabled apps', () => {
  const info = fixture();
  applyWidgetAction(
    info,
    'self',
    { kind: 'clock', key: 'countdown', command: 'start', seconds: 300 },
    1000,
  );
  applyWidgetAction(info, 'self', { kind: 'clock', key: 'countdown', command: 'pause' }, 11000);
  applyWidgetAction(
    info,
    'self',
    { kind: 'clock', key: 'countdown', command: 'start', seconds: 300 },
    21000,
  );
  expect(widgetSnapshot(info, 'self').countdown.value).toBe(311000);
  info.apps = [];
  expect(() =>
    applyWidgetAction(info, 'self', { kind: 'todo-add', id: '4', title: 'No' }, 0),
  ).toThrow('APP_DISABLED');
});
it('rejects invalid durations, arbitrary fields, and remote-target action payloads', () => {
  for (const action of [
    { kind: 'countdown-set', seconds: 86400 },
    { kind: 'clock', key: 'countdown', command: 'start', seconds: -1 },
    { kind: 'todo-edit', id: '1', title: 'Edit', identity: 'other' },
    { kind: 'todo-add', id: '../secret', title: 'Bad' },
  ])
    expect(() => parseNativeWidgetAction(action)).toThrow();
});
