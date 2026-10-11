// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { ApiError } from '@vocespace/client-sdk';
import { canUseNativeChat } from '@vocespace/server-core';
import {
  parseConferenceMessage,
  parseConferenceHistory,
  parseNativeChatRequest,
} from '@vocespace/contracts';
import { createChatController, type ChatSocket } from '../apps/mobile/src/chat/controller';

const meeting = {
  joinId: 'chat-join-12345678',
  identity: 'native_viewer',
  roomName: 'room',
  participantName: 'Viewer',
};
const message = (id = 'message-1', sender = 'native_viewer', roomName = 'room') => ({
  id,
  roomName,
  sender: { id: sender, name: 'Viewer' },
  timestamp: 1,
  type: 'text' as const,
  message: 'hello',
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((r, j) => {
    resolve = r;
    reject = j;
  });
  return { resolve, reject, promise };
};
function fixture() {
  const sockets: ReturnType<typeof makeSocket>[] = [];
  function makeSocket() {
    const listeners = new Map<string, Set<(...args: any[]) => void>>();
    const emit = vi.fn(
      async (_event: string, payload: any): Promise<unknown> => ({ ok: true, id: payload.id }),
    );
    const socket = {
      connected: false as boolean,
      on(event: string, listener: (...args: any[]) => void) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(listener);
      },
      off(event: string, listener: (...args: any[]) => void) {
        listeners.get(event)?.delete(listener);
      },
      connect: vi.fn(() => {}),
      disconnect: vi.fn(() => {
        socket.connected = false;
      }),
      timeout: () => ({ emitWithAck: emit }),
      fire(event: string, ...args: unknown[]) {
        if (event === 'connect') socket.connected = true;
        if (event === 'disconnect') socket.connected = false;
        listeners.get(event)?.forEach((listener) => listener(...args));
      },
      emit,
      listeners,
    } satisfies ChatSocket & Record<string, unknown>;
    return socket;
  }
  let id = 0;
  const ports = {
    socket: vi.fn(() => {
      const s = makeSocket();
      sockets.push(s);
      return s;
    }),
    history: vi.fn(
      async (_joinId: string, _signal: AbortSignal) => [] as ReturnType<typeof message>[],
    ),
    newId: () => `message-${++id}`,
  };
  const controller = createChatController(ports);
  controller.start(meeting);
  return { sockets, ports, controller };
}
it('only confirmed, current, unrevoked Native members in accessible rooms can use chat', () => {
  const principal = {
    client: 'native' as const,
    id: 'session',
    expiresAt: 100,
    identities: { room: 'viewer' },
  };
  const entry = {
    state: 'joined',
    identity: 'viewer',
    spaceName: 'room',
    member: true,
    revoked: false,
    mainRoomOnly: true,
  };
  expect(canUseNativeChat(principal, entry, 'room', 99)).toBe(true);
  for (const patch of [
    { state: 'prepared' },
    { state: 'cancelled' },
    { identity: 'other' },
    { member: false },
    { revoked: true },
    { mainRoomOnly: false },
  ]) {
    expect(canUseNativeChat(principal, { ...entry, ...patch }, 'room', 99)).toBe(false);
  }
  expect(canUseNativeChat(principal, entry, undefined, 99)).toBe(false);
  expect(canUseNativeChat(principal, entry, 'room', 100)).toBe(false);
});
it('validates Native text and removes file URLs and arbitrary fields from display DTOs', () => {
  expect(
    parseNativeChatRequest({
      joinId: meeting.joinId,
      id: 'a',
      roomName: 'room',
      message: ' hello ',
      type: 'text',
    }).message,
  ).toBe('hello');
  for (const patch of [
    { message: ' ' },
    { message: 'a'.repeat(4001) },
    { type: 'file' },
    { file: { url: 'secret' } },
    { id: '' },
  ]) {
    expect(() =>
      parseNativeChatRequest({
        joinId: meeting.joinId,
        id: 'a',
        roomName: 'room',
        message: 'hello',
        type: 'text',
        ...patch,
      }),
    ).toThrow();
  }
  const file = parseConferenceMessage({
    ...message(),
    type: 'file',
    file: { url: 'private' },
    token: 'secret',
  });
  expect(file).not.toHaveProperty('file');
  expect(file).not.toHaveProperty('token');
  expect(file.message).toBeNull();
  expect(() => parseConferenceHistory({ items: Array(51).fill(message()) })).toThrow();
});
it('subscribes before fetching history and merges overlapping live/history messages by sender and ID', async () => {
  const f = fixture();
  const history = deferred<ReturnType<typeof message>[]>();
  f.ports.history.mockReturnValue(history.promise);
  expect(f.ports.history).not.toHaveBeenCalled();
  f.sockets[0].fire('connect');
  f.sockets[0].fire('chat_msg_response', message());
  f.sockets[0].fire('chat_msg_response', message('secret', 'other', 'private-room'));
  history.resolve([message(), message('message-1', 'another-sender')]);
  await vi.waitFor(() => expect(f.controller.getSnapshot().messages).toHaveLength(2));
  expect(f.controller.getSnapshot().messages.every((m) => m.roomName === 'room')).toBe(true);
  f.controller.stop();
});
it('preserves draft on missing ack, coalesces duplicate presses and retries the same message ID', async () => {
  const f = fixture();
  f.sockets[0].fire('connect');
  const ack = deferred<unknown>();
  f.sockets[0].emit.mockReturnValueOnce(ack.promise);
  f.controller.setDraft('hello');
  const sending = f.controller.send();
  f.controller.send();
  expect(f.sockets[0].emit).toHaveBeenCalledOnce();
  ack.reject(new Error('timeout'));
  await sending;
  expect(f.controller.getSnapshot()).toMatchObject({
    draft: 'hello',
    sendError: true,
    sending: false,
  });
  await f.controller.send();
  expect(f.sockets[0].emit.mock.calls.map(([, input]) => input.id)).toEqual([
    'message-1',
    'message-1',
  ]);
  expect(f.controller.getSnapshot()).toMatchObject({ draft: '', sendError: false });
  f.controller.stop();
});
it('does not erase new text typed while the previous message awaits acknowledgement', async () => {
  const f = fixture();
  f.sockets[0].fire('connect');
  const ack = deferred<unknown>();
  f.sockets[0].emit.mockReturnValueOnce(ack.promise);
  f.controller.setDraft('hello');
  const sending = f.controller.send();
  f.controller.setDraft('next message');
  ack.resolve({ ok: true, id: 'message-1' });
  await sending;
  expect(f.controller.getSnapshot().draft).toBe('next message');
  f.controller.stop();
});
it('a trusted own-message broadcast proves delivery even when acknowledgement times out', async () => {
  const f = fixture();
  f.sockets[0].fire('connect');
  const ack = deferred<unknown>();
  f.sockets[0].emit.mockReturnValueOnce(ack.promise);
  f.controller.setDraft('hello');
  const sending = f.controller.send();
  f.sockets[0].fire('chat_msg_response', message());
  ack.reject(new Error('timeout'));
  await sending;
  expect(f.controller.getSnapshot()).toMatchObject({ draft: '', sendError: false, sending: false });
  f.controller.stop();
});
it('ignores old history and acknowledgements after exit and clears all owned listeners', async () => {
  const f = fixture();
  const history = deferred<ReturnType<typeof message>[]>();
  const ack = deferred<unknown>();
  f.ports.history.mockReturnValueOnce(history.promise);
  f.sockets[0].fire('connect');
  f.sockets[0].emit.mockReturnValueOnce(ack.promise);
  f.controller.setDraft('hello');
  const sending = f.controller.send();
  f.controller.start({ ...meeting, joinId: 'next-join-12345678', roomName: 'next' });
  f.controller.setDraft('new room draft');
  history.resolve([message()]);
  ack.resolve({ ok: true, id: 'message-1' });
  await sending;
  await Promise.resolve();
  expect(f.controller.getSnapshot()).toMatchObject({
    joinId: 'next-join-12345678',
    messages: [],
    draft: 'new room draft',
  });
  expect(f.ports.history.mock.calls[0][1].aborted).toBe(true);
  expect([...f.sockets[0].listeners.values()].every((listeners) => !listeners.size)).toBe(true);
  expect(f.sockets[0].disconnect).toHaveBeenCalledOnce();
  f.controller.stop();
});
it('reconnect refetches history, discards the obsolete fetch and never buffers offline writes', async () => {
  const f = fixture();
  const old = deferred<ReturnType<typeof message>[]>();
  f.ports.history.mockReturnValueOnce(old.promise);
  f.sockets[0].fire('connect');
  f.sockets[0].fire('disconnect', 'transport close');
  f.controller.setDraft('hello');
  await f.controller.send();
  expect(f.sockets[0].emit).not.toHaveBeenCalled();
  f.ports.history.mockResolvedValueOnce([message('new')]);
  f.sockets[0].fire('connect');
  old.resolve([message('obsolete')]);
  await vi.waitFor(() =>
    expect(f.controller.getSnapshot().messages.map((m) => m.id)).toEqual(['new']),
  );
  f.controller.stop();
});
it('denies further reads and writes when history reports an expired or revoked membership', async () => {
  const f = fixture();
  f.ports.history.mockRejectedValueOnce(new ApiError(403, 'CHAT_MEMBERSHIP_REQUIRED', 'Denied'));
  f.sockets[0].fire('connect');
  await vi.waitFor(() => expect(f.controller.getSnapshot().connection).toBe('denied'));
  f.controller.setDraft('hello');
  await f.controller.send();
  f.sockets[0].fire('chat_msg_response', message());
  expect(f.sockets[0].emit).not.toHaveBeenCalled();
  expect(f.controller.getSnapshot().messages).toEqual([]);
  f.controller.stop();
});
it('history outage stays visible and permits live messages and explicit reload', async () => {
  const f = fixture();
  f.ports.history.mockRejectedValueOnce(new Error('offline'));
  f.sockets[0].fire('connect');
  await vi.waitFor(() => expect(f.controller.getSnapshot().historyError).toBe(true));
  f.sockets[0].fire('chat_msg_response', message());
  expect(f.controller.getSnapshot().messages).toHaveLength(1);
  await f.controller.refresh();
  expect(f.controller.getSnapshot()).toMatchObject({
    connection: 'connected',
    historyError: false,
  });
  f.controller.stop();
});

it('unlocks sending after a synchronous transport failure so a retry remains possible', async () => {
  const f = fixture();
  f.sockets[0].fire('connect');
  f.sockets[0].emit.mockImplementationOnce(() => {
    throw new Error('transport closed');
  });
  f.controller.setDraft('hello');
  await f.controller.send();
  expect(f.controller.getSnapshot()).toMatchObject({
    draft: 'hello',
    sendError: true,
    sending: false,
  });
  await f.controller.send();
  expect(f.sockets[0].emit).toHaveBeenCalledTimes(2);
  expect(f.controller.getSnapshot().draft).toBe('');
  f.controller.stop();
});

it('child-room chat filters history and incoming main-room messages while raising hands in the owning Space', async () => {
  const f = fixture();
  f.ports.history.mockResolvedValue([message('main', 'host', 'room'), message('child', 'host', 'Meeting Room')]);
  f.controller.start({ ...meeting, childRoom: 'Meeting Room' });
  const socket = f.sockets.at(-1)!;
  socket.fire('connect');
  await f.controller.refresh();
  expect(f.controller.getSnapshot().messages.map(item => item.id)).toEqual(['child']);
  socket.fire('chat_msg_response', message('main-late', 'host', 'room'));
  expect(f.controller.getSnapshot().messages.map(item => item.id)).toEqual(['child']);
  await f.controller.raise();
  expect(socket.emit).toHaveBeenCalledWith('raise', expect.objectContaining({ space: 'room' }));
  f.controller.stop();
});
