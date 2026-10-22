import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useAvoDrafts } from '../apps/mobile/src/conference/settings/hooks/useAvoDrafts';
import type { NativeAvoPreference } from '@vocespace/contracts';
const preset = (name: string, hue: number, isUsed = false): NativeAvoPreference => ({
  name,
  hue,
  isUsed,
  variant: 1,
  style: 'blob',
  energy: 0.6,
  enabled: true,
});
it('hydrates actual presets, keeps each edited draft when loading another, and ignores late refreshes', () => {
  const { result, rerender } = renderHook(
    ({ presets }: { presets?: NativeAvoPreference[] }) => useAvoDrafts('Ada', presets),
    { initialProps: { presets: undefined } as { presets?: NativeAvoPreference[] } },
  );
  const stored = [preset('Blue', 214), preset('Green', 172, true)];
  rerender({ presets: stored });
  expect(result.current.draft.name).toBe('Green');
  act(() => result.current.update({ name: 'My draft', hue: 193 }));
  act(() => result.current.load(0));
  expect(result.current.draft.name).toBe('Blue');
  act(() => result.current.load(1));
  expect(result.current.draft.name).toBe('My draft');
  rerender({ presets: [preset('Late result', 13, true)] });
  expect(result.current.draft.name).toBe('My draft');
  expect(stored[1].name).toBe('Green');
});
it('does not replace a preview edited before loading completes and resets only the selected preset', () => {
  const { result, rerender } = renderHook(
    ({ presets }: { presets?: NativeAvoPreference[] }) => useAvoDrafts('Ada', presets),
    { initialProps: { presets: undefined } as { presets?: NativeAvoPreference[] } },
  );
  act(() => result.current.update({ name: 'Before load', hue: 13, style: 'wave' }));
  rerender({ presets: [preset('Stored', 214, true)] });
  expect(result.current.draft.name).toBe('Before load');
  act(() => result.current.reset());
  expect(result.current.draft).toMatchObject({ name: 'Before load', hue: 193, style: 'blob' });
  act(() => result.current.load(9));
  expect(result.current.selectedIndex).toBe(0);
});
it('keeps backend variants intact through selection, edits and successful persistence', () => {
  const presets = [
    { ...preset('First', 193, true), variant: 81 },
    { ...preset('Second', 172), variant: 922 },
  ];
  const { result } = renderHook(() => useAvoDrafts('Ada', presets));
  expect(result.current.draft.variant).toBe(81);
  act(() => result.current.load(1));
  act(() => result.current.update({ hue: 214 }));
  expect(result.current.draft.variant).toBe(922);
  act(() => result.current.accept([{ ...presets[1], isUsed: true }]));
  expect(result.current.drafts[0].variant).toBe(922);
});
