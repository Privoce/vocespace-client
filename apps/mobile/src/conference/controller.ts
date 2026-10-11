import type { NativeJoin } from '@vocespace/contracts';

export interface ConferenceRoom {
  connect(details: NativeJoin): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(): void | Promise<void>;
}
export type Phase = 'idle' | 'joining' | 'joined' | 'leaving' | 'error';
export interface ConferenceState<R> {
  phase: Phase;
  room?: R;
  spaceName?: string;
  error?: unknown;
  joined?: Pick<NativeJoin, 'joinId' | 'identity' | 'roomName' | 'participantName' | 'childRoom'>;
}
interface Ports<R extends ConferenceRoom> {
  ensureSession(): Promise<void>;
  prepare(
    spaceName: string,
    nickname: string,
    joinId: string,
    signal: AbortSignal,
    childRoom?: string,
    createIfMissing?: boolean,
  ): Promise<NativeJoin>;
  confirm(joinId: string, signal: AbortSignal): Promise<void>;
  leave(joinId: string): Promise<void>;
  createRoom(onDisconnected: () => void): R;
  newId(): string;
}
interface Attempt<R> {
  id: string;
  cancelled: boolean;
  prepared: boolean;
  abort: AbortController;
  room?: R;
  work?: Promise<void>;
  cleanup?: Promise<void>;
}

/** One owner above the tabs: no new room until the previous attempt and its cleanup settle. */
export function createConferenceController<R extends ConferenceRoom>(ports: Ports<R>) {
  let state: ConferenceState<R> = { phase: 'idle' };
  let active: Attempt<R> | undefined;
  const listeners = new Set<() => void>();
  const set = (next: ConferenceState<R>) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function cleanup(attempt: Attempt<R>) {
    if (attempt.cleanup) return attempt.cleanup;
    attempt.cleanup = (async () => {
      await attempt.room?.disconnect();
      if (attempt.prepared) await ports.leave(attempt.id);
      if (active === attempt) active = undefined;
    })();
    try {
      await attempt.cleanup;
    } catch (error) {
      attempt.cleanup = undefined;
      throw error;
    }
  }
  async function leave() {
    const attempt = active;
    if (!attempt) {
      set({ phase: 'idle' });
      return true;
    }
    attempt.cancelled = true;
    attempt.abort.abort();
    set({ ...state, phase: 'leaving', error: undefined });
    await attempt.work;
    try {
      await cleanup(attempt);
      set({ phase: 'idle' });
      return true;
    } catch (error) {
      set({ phase: 'error', error });
      return false;
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hasPendingCleanup: () => !!active,
    leave,
    join(spaceName: string, nickname: string, childRoom?: string, createIfMissing = false) {
      if (active) return active.work;
      const attempt: Attempt<R> = {
        id: ports.newId(),
        cancelled: false,
        prepared: false,
        abort: new AbortController(),
      };
      active = attempt;
      set({ phase: 'joining', spaceName });
      attempt.work = (async () => {
        try {
          await ports.ensureSession();
          if (attempt.cancelled) return;
          attempt.prepared = true; // The server may receive prepare even when its response is lost.
          const details = await ports.prepare(
            spaceName,
            nickname,
            attempt.id,
            attempt.abort.signal,
            childRoom,
            createIfMissing,
          );
          if (attempt.cancelled) return;
          attempt.room = ports.createRoom(() => {
            if (!attempt.cancelled) void leave();
          });
          await attempt.room.connect(details);
          if (attempt.cancelled) return;
          await ports.confirm(attempt.id, attempt.abort.signal);
          if (attempt.cancelled) return;
          await attempt.room.subscribe();
          if (attempt.cancelled) return;
          set({
            phase: 'joined',
            room: attempt.room,
            spaceName,
            joined: {
              joinId: details.joinId,
              identity: details.identity,
              roomName: details.roomName,
              participantName: details.participantName,
              childRoom: details.childRoom,
            },
          });
        } catch (error) {
          if (!attempt.cancelled) set({ phase: 'error', error });
        } finally {
          if (state.phase !== 'joined' || attempt.cancelled) {
            try {
              await cleanup(attempt);
              // Publish cleared ownership so the view offers retry after a failed join.
              if (!attempt.cancelled) set({ ...state });
            } catch (error) {
              set({ phase: 'error', error });
            }
          }
        }
      })();
      return attempt.work;
    },
  };
}
