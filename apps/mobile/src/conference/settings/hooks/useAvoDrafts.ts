import { useEffect, useRef, useState } from 'react';
import type { NativeAvoPreference } from '@vocespace/contracts';
export type AvoDraft = Pick<
  NativeAvoPreference,
  'name' | 'hue' | 'energy' | 'style' | 'enabled' | 'variant'
>;
const fallback = (name: string): AvoDraft => ({
  name,
  variant: 0,
  hue: 193,
  energy: 0.6,
  style: 'blob',
  enabled: true,
});
/** All edits stay in this meeting's preview. A late refresh cannot overwrite an edited preset. */
export function useAvoDrafts(name: string, presets?: NativeAvoPreference[]) {
  const [drafts, setDrafts] = useState<AvoDraft[]>(() =>
    presets?.length ? presets.map((item) => ({ ...item })) : [fallback(name)],
  );
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.max(0, presets?.findIndex((item) => item.isUsed) ?? 0),
  );
  const dirty = useRef(false);
  useEffect(() => {
    if (dirty.current || !presets) return;
    setDrafts(presets.length ? presets.map((item) => ({ ...item })) : [fallback(name)]);
    setSelectedIndex(
      Math.max(
        0,
        presets.findIndex((item) => item.isUsed),
      ),
    );
  }, [presets, name]);
  const draft = drafts[selectedIndex] ?? drafts[0];
  const update = (patch: Partial<AvoDraft>) => {
    dirty.current = true;
    setDrafts((previous) =>
      previous.map((item, index) => (index === selectedIndex ? { ...item, ...patch } : item)),
    );
  };
  const load = (index: number) => {
    if (index < 0 || index >= drafts.length) return;
    dirty.current = true;
    setSelectedIndex(index);
  };
  return {
    draft,
    drafts,
    selectedIndex,
    update,
    load,
    accept: (values: NativeAvoPreference[]) => {
      dirty.current = false;
      setDrafts(values.length ? values.map((item) => ({ ...item })) : [fallback(name)]);
      setSelectedIndex(
        Math.max(
          0,
          values.findIndex((item) => item.isUsed),
        ),
      );
    },
    reset: () => update(fallback(draft.name || name || 'guest')),
  };
}
