import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeWidgetAction, NativeWidgets } from '@vocespace/contracts';
import type { NativeRoom } from '../room';

export function useParticipantWidgets(room: NativeRoom, enabled: boolean) {
  const [data, setData] = useState<NativeWidgets>();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const life = useRef<AbortController | undefined>(undefined);
  const writing = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    life.current = controller;
    generation.current++;
    setData(undefined);
    setError(false);
    setBusy(false);
    writing.current = false;
    if (!enabled) return () => controller.abort();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const version = generation.current;
      if (!writing.current) {
        try {
          const next = await room.widgets(undefined, controller.signal);
          if (!controller.signal.aborted && version === generation.current) {
            setData(next);
            setError(false);
          }
        } catch {
          if (!controller.signal.aborted && version === generation.current) setError(true);
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void load(), 10000);
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [room, enabled]);
  const update = useCallback(
    async (action: NativeWidgetAction) => {
      const controller = life.current;
      if (!enabled || !controller || controller.signal.aborted || writing.current) return false;
      writing.current = true;
      generation.current++;
      setBusy(true);
      setError(false);
      try {
        const next = await room.widgets(action, controller.signal);
        if (controller.signal.aborted) return false;
        setData(next);
        void room.syncDirectory().catch(() => undefined);
        return true;
      } catch {
        if (!controller.signal.aborted) setError(true);
        return false;
      } finally {
        if (!controller.signal.aborted) {
          writing.current = false;
          setBusy(false);
        }
      }
    },
    [room, enabled],
  );
  return { data, busy, error, update };
}
