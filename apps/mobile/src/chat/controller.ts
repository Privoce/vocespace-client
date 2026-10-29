import type { Analytics } from '@vocespace/client-sdk';
import { ApiError } from '@vocespace/client-sdk';
import {
  CONFERENCE_CHAT_LIMIT,
  CONFERENCE_MESSAGE_LIMIT,
  parseConferenceMessage,
  type ConferenceMessage,
  type NativeJoin,
} from '@vocespace/contracts';

export interface ChatSocket {
  connected: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
  connect(): unknown;
  disconnect(): unknown;
  timeout(ms: number): { emitWithAck(event: string, payload: unknown): Promise<unknown> };
}
export type ChatMeeting = Pick<NativeJoin, 'joinId' | 'identity' | 'roomName' | 'participantName' | 'childRoom'>;
export interface ChatState {
  joinId?: string;
  connection: 'idle' | 'connecting' | 'connected' | 'offline' | 'denied';
  messages: ConferenceMessage[];
  draft: string;
  sending: boolean;
  sendError: boolean;
  loadingHistory: boolean;
  historyError: boolean;
}
interface Ports {
  analytics?: Analytics;
  socket(joinId: string): ChatSocket;
  history(joinId: string, signal: AbortSignal): Promise<ConferenceMessage[]>;
  newId(): string;
}
const empty = (): ChatState => ({
  connection: 'idle',
  messages: [],
  draft: '',
  sending: false,
  sendError: false,
  loadingHistory: false,
  historyError: false,
});
const deniedCodes = new Set([
  'SESSION_REQUIRED',
  'SESSION_REVOKED',
  'MEMBERSHIP_REVOKED',
  'CHAT_MEMBERSHIP_REQUIRED',
  'SPACE_ACCESS_DENIED',
]);

/** One chat scope per confirmed meeting. Late acknowledgements/history cannot enter the next room. */
export function createChatController(ports: Ports) {
  let state = empty();
  let dispose: (() => void) | undefined;
  let send: (() => Promise<void>) | undefined;
  let refresh: (() => Promise<void>) | undefined;
  let reconnect: (() => void) | undefined;
  const controls = new Set<(event: string, value: unknown) => void>();
  let raise: ((raised: boolean) => Promise<boolean>) | undefined;
  const listeners = new Set<() => void>();
  const update = (change: Partial<ChatState>) => {
    state = { ...state, ...change };
    listeners.forEach((listener) => listener());
  };
  const stop = () => {
    dispose?.();
    dispose = send = refresh = reconnect = undefined;
    raise = undefined;
    state = empty();
    update({});
  };
  return {
    getSnapshot: () => state,
    onControl(listener: (event: string, value: unknown) => void) {
      controls.add(listener);
      return () => {
        controls.delete(listener);
      };
    },
    raise: (raised = true) => raise?.(raised) || Promise.resolve(false),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setDraft(draft: string) {
      update({ draft: draft.slice(0, CONFERENCE_MESSAGE_LIMIT), sendError: false });
    },
    send: () => send?.(),
    refresh: () => refresh?.(),
    reconnect: () => reconnect?.(),
    stop,
    start(meeting: ChatMeeting) {
      stop();
      let active = true;
      let forbidden = false;
      let historyAbort: AbortController | undefined;
      let pending: { id: string; text: string; draft: string } | undefined;
      let flight: Promise<void> | undefined;
      const socket = ports.socket(meeting.joinId);
      update({ joinId: meeting.joinId, connection: 'connecting' });
      function deny() {
        if (!active || forbidden) return;
        forbidden = true;
        historyAbort?.abort();
        socket.disconnect();
        update({ connection: 'denied', messages: [], sending: false, loadingHistory: false });
      }
      function delivered(id: string, senderId: string) {
        if (!pending || pending.id !== id || senderId !== meeting.identity) return;
        const draft = state.draft === pending.draft ? '' : state.draft;
        pending = undefined;
        update({ draft, sendError: false });
      }
      function merge(items: ConferenceMessage[]) {
        const all = new Map(state.messages.map((item) => [`${item.sender.id}:${item.id}`, item]));
        for (const item of items) {
          if (item.roomName !== (meeting.childRoom || meeting.roomName)) continue;
          all.set(`${item.sender.id}:${item.id}`, item);
          delivered(item.id, item.sender.id);
        }
        update({
          messages: [...all.values()]
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-CONFERENCE_CHAT_LIMIT),
        });
      }
      async function history() {
        if (!active || forbidden || !socket.connected) return;
        historyAbort?.abort();
        const abort = new AbortController();
        historyAbort = abort;
        update({ loadingHistory: true, historyError: false });
        try {
          const items = await ports.history(meeting.joinId, abort.signal);
          if (active && !forbidden && !abort.signal.aborted) merge(items);
        } catch (error) {
          if (!active || forbidden || abort.signal.aborted) return;
          if (error instanceof ApiError && [401, 403].includes(error.status)) deny();
          else update({ historyError: true });
        } finally {
          if (active && !abort.signal.aborted) update({ loadingHistory: false });
        }
      }
      const connected = () => {
        if (!active || forbidden) return;
        update({ connection: 'connected' });
        void history();
      };
      const disconnected = (reason: string) => {
        if (!active || forbidden) return;
        if (reason === 'io server disconnect') return deny();
        historyAbort?.abort();
        update({ connection: 'offline', loadingHistory: false });
      };
      const failed = (error: Error) => {
        if (!active || forbidden) return;
        if (deniedCodes.has(error.message)) deny();
        else update({ connection: 'offline' });
      };
      const receive = (value: unknown) => {
        if (!active || forbidden) return;
        try {
          merge([parseConferenceMessage(value)]);
        } catch {
          /* Ignore unsupported/malformed events. */
        }
      };
      const control = (event: string) => (value: unknown) => {
        if (active && !forbidden) controls.forEach((listener) => listener(event, value));
      };
      const handlers = {
        native_media_invitation: control('invitation'),
        native_media_revoked: control('revoked'),
        raise_cancel_response: control('raise_cancel'),
        connect: connected,
        disconnect: disconnected,
        connect_error: failed,
        chat_msg_response: receive,
        chat_file_response: receive,
      };
      for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
      send = () => {
        if (flight) return flight;
        if (!active || forbidden || !socket.connected || !state.draft.trim())
          return Promise.resolve();
        const text = state.draft.trim();
        if (!pending || pending.text !== text)
          pending = { id: ports.newId(), text, draft: state.draft };
        const attempt = pending;
        const operation = ports.analytics?.begin('chat_send', { source: 'meeting', scope: meeting.childRoom ? 'child' : 'main', message_type: 'text' });
        update({ sending: true, sendError: false });
        flight = (async () => {
          try {
            const response = await socket.timeout(8000).emitWithAck('chat_msg', {
              id: attempt.id,
              joinId: meeting.joinId,
              roomName: meeting.childRoom || meeting.roomName,
              message: attempt.text,
              type: 'text',
              file: null,
            });
            if (!active || forbidden) return;
            const ack = response as { ok?: unknown; id?: unknown; code?: unknown } | null;
            if (ack?.ok !== true || ack.id !== attempt.id) {
              operation?.fail({ code: ack?.code });
              if (typeof ack?.code === 'string' && deniedCodes.has(ack.code)) deny();
              else throw new Error('SEND_UNCONFIRMED');
              return;
            }
            operation?.end('success');
            delivered(attempt.id, meeting.identity);
            // A duplicate ack may have no broadcast (e.g. the first acknowledgement was lost).
            void history();
          } catch (error) {
            operation?.fail(error);
            if (active && !forbidden && pending === attempt) update({ sendError: true });
          }
        })().finally(() => {
          operation?.end('cancelled');
          flight = undefined;
          if (active && !forbidden) update({ sending: false });
        });
        return flight;
      };
      raise = async (raised) => {
        if (!active || forbidden || !socket.connected) return false;
        try {
          const response = (await socket.timeout(8000).emitWithAck('raise', {
            raised,
            space: meeting.roomName,
            senderId: meeting.identity,
            senderName: meeting.participantName,
          })) as { ok?: boolean };
          return active && !forbidden && response?.ok === true;
        } catch {
          return false;
        }
      };
      refresh = history;
      reconnect = () => {
        if (active && !forbidden && !socket.connected) {
          update({ connection: 'connecting' });
          socket.connect();
        }
      };
      dispose = () => {
        active = false;
        historyAbort?.abort();
        for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
        socket.disconnect();
      };
      socket.connect();
    },
  };
}
