import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { NativeRoom } from '../src/conference/room';
import type { NativeWidgets } from '@vocespace/contracts';
import { useParticipantWidgets } from '../src/conference/hooks/useParticipantWidgets';
const snapshot = (name: string) => ({ name }) as NativeWidgets;
afterEach(() => cleanup());
it('does not let a read started before a write replace the saved widget data', async () => {
  let finish!: (value: NativeWidgets) => void;
  const widgets = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<NativeWidgets>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(snapshot('saved'));
  const room = {
    widgets,
    syncDirectory: vi.fn().mockResolvedValue(undefined),
  } as unknown as NativeRoom;
  const hook = renderHook(() => useParticipantWidgets(room, true));
  await act(async () => {
    expect(await hook.result.current.update({ kind: 'sync', key: 'todo', visible: true })).toBe(
      true,
    );
  });
  await act(async () => {
    finish(snapshot('stale'));
  });
  expect(hook.result.current.data?.name).toBe('saved');
});
it('cancels old reads and does not load private widgets for another participant', async () => {
  let finish!: (value: NativeWidgets) => void;
  const widgets = vi.fn().mockImplementation(
    () =>
      new Promise<NativeWidgets>((resolve) => {
        finish = resolve;
      }),
  );
  const room = { widgets } as unknown as NativeRoom;
  const hook = renderHook(({ own }) => useParticipantWidgets(room, own), {
    initialProps: { own: true },
  });
  hook.rerender({ own: false });
  expect(widgets.mock.calls[0][1].aborted).toBe(true);
  await act(async () => {
    finish(snapshot('private'));
  });
  expect(hook.result.current.data).toBeUndefined();
  expect(widgets).toHaveBeenCalledTimes(1);
});
