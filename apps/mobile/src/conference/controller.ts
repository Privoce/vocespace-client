import type { Analytics, AnalyticsOperation } from '@vocespace/client-sdk';
import type { AnalyticsSource, AnalyticsLeaveReason } from '@vocespace/contracts';
import { atJoinStage } from './join-error';
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
  analytics?: Analytics;
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
  operation?: AnalyticsOperation;
  switchOperation?: AnalyticsOperation;
  joinedAt?: number;
  left?: boolean;
  reason?: AnalyticsLeaveReason;
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
      if (attempt.joinedAt !== undefined && !attempt.left) {
        attempt.left = true;
        ports.analytics?.track('space_leave', {
          reason: attempt.reason || 'unknown',
          duration_seconds: (Date.now() - attempt.joinedAt) / 1000,
        });
      }
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
  async function leave(reason: AnalyticsLeaveReason = 'user') {
    const attempt = active;
    if (!attempt) {
      set({ phase: 'idle' });
      return true;
    }
    attempt.reason ??= reason;
    attempt.operation?.end('cancelled');
    attempt.switchOperation?.end('cancelled');
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
    join(
      spaceName: string,
      nickname: string,
      childRoom?: string,
      createIfMissing = false,
      options: {
        source?: AnalyticsSource;
        method?: 'manual' | 'auto';
        switchFrom?: 'main' | 'child';
      } = {},
    ) {
      if (active) return active.work;
      const attempt: Attempt<R> = {
        id: ports.newId(),
        cancelled: false,
        prepared: false,
        abort: new AbortController(),
        operation: ports.analytics?.begin('space_join', {
          source: options.source || 'unknown',
          join_method: options.method || 'manual',
          target: childRoom ? 'child' : 'main',
        }),
        switchOperation: options.switchFrom
          ? ports.analytics?.begin('room_switch', {
              source: 'room_switch',
              from_type: options.switchFrom,
              to_type: childRoom ? 'child' : 'main',
            })
          : undefined,
      };
      active = attempt;
      set({ phase: 'joining', spaceName });
      attempt.work = (async () => {
        try {
          await atJoinStage('session', ports.ensureSession);
          if (attempt.cancelled) return;
          attempt.prepared = true; // The server may receive prepare even when its response is lost.
          const details = await atJoinStage('prepare', () =>
            ports.prepare(
              spaceName,
              nickname,
              attempt.id,
              attempt.abort.signal,
              childRoom,
              createIfMissing,
            ),
          );
          if (attempt.cancelled) return;
          attempt.room = ports.createRoom(() => {
            if (!attempt.cancelled) void leave('disconnected');
          });
          await atJoinStage('connect', () => attempt.room!.connect(details));
          if (attempt.cancelled) return;
          await atJoinStage('confirm', () => ports.confirm(attempt.id, attempt.abort.signal));
          if (attempt.cancelled) return;
          await atJoinStage('settings', async () => attempt.room!.subscribe());
          if (attempt.cancelled) return;
          attempt.joinedAt = Date.now();
          attempt.operation?.end('success');
          attempt.switchOperation?.end('success');
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
          if (!attempt.cancelled) {
            attempt.operation?.fail(error, { failure_stage: (error as { stage?: string })?.stage });
            attempt.switchOperation?.fail(error);
            set({ phase: 'error', error });
          }
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
