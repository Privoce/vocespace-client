import { analyticsError } from '@vocespace/contracts';
import type { Analytics } from '@vocespace/client-sdk';
export const PREVIEW_JOIN_DELAY_MS = 10_000;
export interface PreviewState {
  space?: string;
  phase: 'idle' | 'loading' | 'playing' | 'joining' | 'error';
  remainingMs: number;
  error?: unknown;
}
interface PreviewPorts {
  analytics?: Analytics;
  now(): number;
  stop(): Promise<void>;
  join(space: string, automatic?: boolean): Promise<void>;
}
/** Media readiness is supplied by the preview player, never by an RTC prejoin connection. */
export function createPreviewController(ports: PreviewPorts) {
  let state: PreviewState = { phase: 'idle', remainingMs: PREVIEW_JOIN_DELAY_MS };
  let version = 0;
  let firstFrameAt: number | undefined;
  let lastProgressAt: number | undefined;
  let playingMs = 0;
  let previousPosition: number | undefined;
  let totalPlayingMs = 0;
  let trackedPlaying = false;
  let terminal = true;
  const playing = () => {
    if (trackedPlaying || terminal) return;
    trackedPlaying = true;
    ports.analytics?.track('space_preview', {
      phase: 'playing',
      source: 'plaza',
      valid_play_seconds: 0,
    });
  };
  const finish = (reason: string, error?: unknown) => {
    if (terminal) return;
    terminal = true;
    if (trackedPlaying || reason === 'error')
      ports.analytics?.track('space_preview', {
        phase: reason === 'error' ? 'failure' : 'ended',
        source: 'plaza',
        end_reason: reason,
        valid_play_seconds: totalPlayingMs / 1000,
        ...(reason === 'error' ? { error_code: analyticsError(error) } : {}),
      });
  };
  let autoJoin = true;
  let allowed = true;
  let joinFlight: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<PreviewState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const resetPlayback = () => {
    firstFrameAt = undefined;
    lastProgressAt = undefined;
    previousPosition = undefined;
    playingMs = 0;
  };
  const join = (automatic = false) => {
    if (joinFlight || !allowed || !state.space || state.phase === 'joining') return joinFlight;
    if (automatic && (!autoJoin || state.phase !== 'playing' || state.remainingMs > 0)) return;
    const space = state.space;
    const generation = version;
    finish('join');
    set({ phase: 'joining' });
    joinFlight = (async () => {
      try {
        // The player must be fully released before the formal RTC acquires audio/video resources.
        await ports.stop();
        if (!allowed || generation !== version || state.space !== space) return;
        await ports.join(space, automatic);
      } catch (error) {
        if (generation === version) set({ phase: 'error', error });
      }
    })().finally(() => {
      joinFlight = undefined;
    });
    return joinFlight;
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    firstFrame(generation: number) {
      if (generation === version && allowed) playing();
    },
    activate(space: string, enabled: boolean) {
      finish('swipe');
      trackedPlaying = false;
      terminal = false;
      totalPlayingMs = 0;
      version++;
      allowed = true;
      autoJoin = enabled;
      resetPlayback();
      set({ space, phase: 'loading', remainingMs: PREVIEW_JOIN_DELAY_MS, error: undefined });
      return version;
    },
    /** Dragging, an obscuring dialog, inactive App or tab exit invalidate late player callbacks. */
    suspend(reason: 'swipe' | 'background' | 'tab_change' = 'swipe') {
      finish(reason);
      version++;
      allowed = false;
      resetPlayback();
      set({ phase: 'idle', remainingMs: PREVIEW_JOIN_DELAY_MS });
    },
    progress(generation: number, positionSeconds: number) {
      if (
        generation !== version ||
        !allowed ||
        state.phase === 'joining' ||
        state.phase === 'error'
      )
        return;
      if (!Number.isFinite(positionSeconds)) return;
      const now = ports.now();
      if (
        previousPosition !== undefined &&
        positionSeconds > previousPosition &&
        lastProgressAt !== undefined
      ) {
        // A stalled player must not accumulate wall-clock time towards joining.
        if (now - lastProgressAt > 1000) {
          resetPlayback();
        } else {
          const delta = Math.min(now - lastProgressAt, (positionSeconds - previousPosition) * 1000);
          playingMs += delta;
          totalPlayingMs += delta;
        }
      }
      if (previousPosition !== undefined && positionSeconds <= previousPosition) return;
      firstFrameAt ??= now;
      previousPosition = positionSeconds;
      lastProgressAt = now;
      const remainingMs = Math.max(
        0,
        PREVIEW_JOIN_DELAY_MS - Math.min(now - firstFrameAt, playingMs),
      );
      set({ phase: 'playing', remainingMs });
      if (remainingMs === 0) void join(true);
    },
    fail(generation: number, error: unknown) {
      if (generation === version && allowed && state.phase !== 'joining') {
        resetPlayback();
        finish('error', error);
        set({ phase: 'error', error, remainingMs: PREVIEW_JOIN_DELAY_MS });
      }
    },
    join: () => join(false),
  };
}
