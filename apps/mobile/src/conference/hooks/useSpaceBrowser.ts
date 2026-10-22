import { meetingFailure } from '../meetingFailure';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { NativeSpaceSummary } from '@vocespace/contracts';
import type { useConference } from './useConference';
export function useSpaceBrowser(model: ReturnType<typeof useConference>, initiallyOpen = false) {
  const [spaces, setSpaces] = useState<NativeSpaceSummary[]>([]);
  const [open, setOpen] = useState(initiallyOpen);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const switching = useRef(false);
  useEffect(() => {
    if (!model.configured) return;
    const abort = new AbortController();
    let pending = false;
    const reload = async () => {
      if (pending || abort.signal.aborted) return;
      pending = true;
      try {
        const items = await model.listSpaces(abort.signal);
        if (!abort.signal.aborted) {
          setSpaces(items);
          setError(undefined);
          setIndex((previous) => Math.min(previous, Math.max(0, items.length - 1)));
        }
      } catch (error) {
        if (!abort.signal.aborted) setError(meetingFailure(error));
      } finally {
        pending = false;
      }
    };
    void reload();
    const timer = open
      ? setInterval(() => {
          if (AppState.currentState === 'active') void reload();
        }, 15000)
      : undefined;
    const listener = open
      ? AppState.addEventListener('change', (next) => {
          if (next === 'active') void reload();
        })
      : undefined;
    return () => {
      abort.abort();
      clearInterval(timer);
      listener?.remove();
    };
  }, [model.configured, model.listSpaces, revision, open]);
  const browse = useCallback(
    async (direction: number) => {
      if (switching.current || spaces.length < 2) return;
      const current = spaces.findIndex((item) => item.name === model.state.spaceName);
      const next = current + direction;
      if (next < 0 || next >= spaces.length) return;
      switching.current = true;
      try {
        if (await model.leave()) {
          setIndex(next);
          setOpen(true);
        }
      } finally {
        switching.current = false;
      }
    },
    [model, spaces],
  );
  return {
    spaces,
    open,
    index,
    error,
    setOpen,
    setIndex,
    browse,
    refresh: () => setRevision((value) => value + 1),
  };
}
