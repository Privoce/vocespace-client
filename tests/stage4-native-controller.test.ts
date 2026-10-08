// @vitest-environment node
import { expect, it, vi } from 'vitest';
import {
  createConferenceController,
  type ConferenceRoom,
} from '../apps/mobile/src/conference/controller';
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((r, j) => {
    resolve = r;
    reject = j;
  });
  return { promise, resolve, reject };
};
const details = {
  joinId: 'test-join-12345678',
  identity: 'viewer',
  roomName: 'room',
  participantName: 'Viewer',
  serverUrl: 'wss://test.invalid',
  participantToken: 'test',
};
function fixture() {
  const room = {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    subscribe: vi.fn(),
  } satisfies ConferenceRoom;
  const ports = {
    ensureSession: vi.fn(async () => {}),
    prepare: vi.fn(async () => details),
    confirm: vi.fn(async () => {}),
    leave: vi.fn(async () => {}),
    createRoom: vi.fn(() => room),
    newId: () => details.joinId,
  };
  return { room, ports, controller: createConferenceController(ports) };
}
it('allows one join and starts subscriptions only after server confirmation', async () => {
  const f = fixture();
  const confirmed = deferred<void>();
  f.ports.confirm.mockReturnValue(confirmed.promise);
  const joining = f.controller.join('room', 'Viewer');
  f.controller.join('other', 'Other');
  await vi.waitFor(() => expect(f.ports.confirm).toHaveBeenCalledOnce());
  expect(f.room.subscribe).not.toHaveBeenCalled();
  expect(f.ports.prepare).toHaveBeenCalledOnce();
  confirmed.resolve();
  await joining;
  expect(f.controller.getSnapshot().phase).toBe('joined');
  expect(f.room.subscribe).toHaveBeenCalledOnce();
  await f.controller.leave();
  expect(f.room.disconnect).toHaveBeenCalledOnce();
  expect(f.ports.leave).toHaveBeenCalledOnce();
});
it('cleans up a prepare response that arrives after cancellation without opening RTC', async () => {
  const f = fixture();
  const preparing = deferred<typeof details>();
  f.ports.prepare.mockReturnValue(preparing.promise);
  const joining = f.controller.join('room', 'Viewer');
  await vi.waitFor(() => expect(f.ports.prepare).toHaveBeenCalled());
  const leaving = f.controller.leave();
  preparing.resolve(details);
  await Promise.all([joining, leaving]);
  expect(f.ports.createRoom).not.toHaveBeenCalled();
  expect(f.ports.leave).toHaveBeenCalledWith(details.joinId);
  expect(f.controller.getSnapshot().phase).toBe('idle');
});
it('disconnects a late RTC connection before admitting a new join', async () => {
  const f = fixture();
  const connection = deferred<void>();
  f.room.connect.mockReturnValue(connection.promise);
  const joining = f.controller.join('room', 'Viewer');
  await vi.waitFor(() => expect(f.room.connect).toHaveBeenCalled());
  const leaving = f.controller.leave();
  f.controller.join('other', 'Viewer');
  expect(f.ports.prepare).toHaveBeenCalledOnce();
  connection.resolve();
  await Promise.all([joining, leaving]);
  expect(f.ports.confirm).not.toHaveBeenCalled();
  expect(f.room.disconnect).toHaveBeenCalledOnce();
  expect(f.controller.hasPendingCleanup()).toBe(false);
});
it('retains failed server cleanup for explicit retry and blocks replacement RTC', async () => {
  const f = fixture();
  await f.controller.join('room', 'Viewer');
  f.ports.leave.mockRejectedValueOnce(new Error('offline'));
  expect(await f.controller.leave()).toBe(false);
  f.controller.join('other', 'Viewer');
  expect(f.ports.prepare).toHaveBeenCalledOnce();
  expect(f.controller.hasPendingCleanup()).toBe(true);
  expect(await f.controller.leave()).toBe(true);
  expect(f.controller.hasPendingCleanup()).toBe(false);
});
it('never subscribes if a late confirmation follows cancellation', async () => {
  const f = fixture();
  const confirmation = deferred<void>();
  f.ports.confirm.mockReturnValue(confirmation.promise);
  const joining = f.controller.join('room', 'Viewer');
  await vi.waitFor(() => expect(f.ports.confirm).toHaveBeenCalled());
  const leaving = f.controller.leave();
  confirmation.resolve();
  await Promise.all([joining, leaving]);
  expect(f.room.subscribe).not.toHaveBeenCalled();
  expect(f.ports.leave).toHaveBeenCalledOnce();
});

it('notifies the view after failed joining has released its cleanup lock', async () => {
  const f = fixture();
  f.ports.confirm.mockRejectedValueOnce(new Error('not ready'));
  const pending: boolean[] = [];
  f.controller.subscribe(() => pending.push(f.controller.hasPendingCleanup()));
  await f.controller.join('room', 'Viewer');
  expect(f.controller.getSnapshot().phase).toBe('error');
  expect(pending.at(-1)).toBe(false);
  await f.controller.join('room', 'Viewer');
  expect(f.controller.getSnapshot().phase).toBe('joined');
});
