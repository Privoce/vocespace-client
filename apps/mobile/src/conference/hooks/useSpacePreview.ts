import { analytics } from '../../analytics';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useVideoPlayer } from 'expo-video';
import type { LocalSettings } from '../../settings/model';
import type { useConference } from './useConference';
import { createPreviewController } from '../preview-controller';

/** One independent HLS player for the visible page; it owns neither a LiveKit Room nor a chat socket. */
export function useSpacePreview({
  model,
  space,
  active,
  preferences,
  join,
  inactiveReason = 'swipe',
}: {
  model: ReturnType<typeof useConference>;
  space?: string;
  active: boolean;
  preferences: LocalSettings;
  join: (space: string, automatic?: boolean) => Promise<void>;
  inactiveReason?: 'swipe' | 'tab_change';
}) {
  const player = useVideoPlayer(null, (player) => {
    player.timeUpdateEventInterval = 0.25;
    player.audioMixingMode = 'mixWithOthers';
    player.allowsExternalPlayback = false;
    player.staysActiveInBackground = false;
  });
  const latest = useRef({ model, join, preferences });
  latest.current = { model, join, preferences };
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [revision, retry] = useState(0);
  const [availability, setAvailability] = useState<'loading' | 'unavailable' | 'error' | 'ready'>(
    'loading',
  );
  const current = useRef<
    | {
        abort: AbortController;
        lease?: string;
        timer?: ReturnType<typeof setTimeout>;
        generation: number;
        frame: boolean;
      }
    | undefined
  >(undefined);
  const queue = useRef(Promise.resolve());
  const stop = useCallback(async () => {
    const previous = current.current;
    current.current = undefined;
    previous?.abort.abort();
    clearTimeout(previous?.timer);
    if (previous?.lease)
      void latest.current.model.releasePreview(previous.lease).catch(() => undefined);
    player.pause();
    queue.current = queue.current.catch(() => undefined).then(() => player.replaceAsync(null));
    await queue.current;
  }, [player]);
  const [controller] = useState(() =>
    createPreviewController({
      analytics,
      now: Date.now,
      stop,
      join: (name, automatic) => latest.current.join(name, automatic),
    }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const exitReason = useRef(inactiveReason);
  exitReason.current = inactiveReason;
  const cancel = useCallback(
    (reason: 'swipe' | 'background' | 'tab_change' = exitReason.current) => {
      controller.suspend(reason);
      void stop().catch(() => undefined);
    },
    [controller, stop],
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') cancel('background');
      setForeground(next === 'active');
    });
    return () => subscription.remove();
  }, [cancel]);
  useEffect(() => {
    player.muted = preferences.previewMuted;
  }, [player, preferences.previewMuted]);
  useEffect(() => {
    if (!active || !space || !foreground) {
      cancel();
      return;
    }
    const run = {
      abort: new AbortController(),
      generation: controller.activate(space, preferences.autoJoin),
      frame: false,
      lease: undefined as string | undefined,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    current.current = run;
    setAvailability('loading');
    const fail = (error: unknown) => {
      if (current.current !== run) return;
      player.pause();
      controller.fail(run.generation, error);
      setAvailability('error');
    };
    const renew = async () => {
      if (current.current !== run || !run.lease) return;
      try {
        await latest.current.model.renewPreview(run.lease, run.abort.signal);
        if (current.current === run)
          run.timer = setTimeout(() => {
            void renew();
          }, 30_000);
      } catch (error) {
        fail(error);
      }
    };
    const load = async () => {
      try {
        const result = await latest.current.model.preview(space, run.abort.signal);
        if (current.current !== run) {
          if (result.status === 'ready')
            void latest.current.model.releasePreview(result.leaseId).catch(() => undefined);
          return;
        }
        if (result.status !== 'ready') {
          setAvailability(result.status === 'starting' ? 'loading' : 'unavailable');
          run.timer = setTimeout(
            () => {
              void load();
            },
            result.status === 'starting' ? 2500 : 10_000,
          );
          return;
        }
        run.lease = result.leaseId;
        queue.current = queue.current
          .catch(() => undefined)
          .then(async () => {
            if (current.current !== run) return;
            await player.replaceAsync({ uri: result.url, contentType: 'hls', useCaching: false });
            if (current.current !== run) return;
            player.play();
            setAvailability('ready');
            run.timer = setTimeout(() => {
              void renew();
            }, 30_000);
          });
        await queue.current;
      } catch (error) {
        fail(error);
      }
    };
    // Stability window avoids starting Egress while a page merely crosses the viewport.
    run.timer = setTimeout(() => {
      void load();
    }, 300);
    const status = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') fail(error);
    });
    const progress = player.addListener('timeUpdate', ({ currentTime }) => {
      if (current.current === run && run.frame && player.playing && player.status === 'readyToPlay')
        controller.progress(run.generation, currentTime);
    });
    return () => {
      status.remove();
      progress.remove();
      cancel();
    };
  }, [active, cancel, controller, foreground, player, preferences.autoJoin, revision, space]);
  return {
    player,
    state,
    availability: state.phase === 'error' ? 'error' : availability,
    cancel,
    firstFrame: () => {
      if (current.current) {
        current.current.frame = true;
        controller.firstFrame(current.current.generation);
      }
    },
    join: () => {
      void controller.join();
    },
    retry: () => retry((value) => value + 1),
  };
}
