// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createPreviewController } from '../apps/mobile/src/conference/preview-controller';
function setup() {
  let now = 0;
  const join = vi.fn().mockResolvedValue(undefined);
  const stop = vi.fn().mockResolvedValue(undefined);
  const controller = createPreviewController({ now: () => now, join, stop });
  return {
    controller,
    join,
    stop,
    time: (value: number) => {
      now = value;
    },
  };
}
it('requires 15 seconds of real playback, never counts loading time, and joins once', async () => {
  const { controller, time, join, stop } = setup();
  const generation = controller.activate('space', true);
  time(100000);
  expect(join).not.toHaveBeenCalled();
  for (let tick = 0; tick < 60; tick++) {
    time(100000 + tick * 250);
    controller.progress(generation, tick / 4);
  }
  expect(join).not.toHaveBeenCalled();
  time(115000);
  controller.progress(generation, 15);
  await controller.join();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(join).toHaveBeenCalledExactlyOnceWith('space');
});
it('suspends countdown immediately on drag/background and ignores late frames from the old Space', async () => {
  const { controller, time, join } = setup();
  const old = controller.activate('A', true);
  controller.progress(old, 0);
  controller.suspend();
  time(20000);
  controller.progress(old, 20);
  expect(join).not.toHaveBeenCalled();
  controller.activate('B', true);
  controller.progress(old, 21);
  expect(controller.getSnapshot()).toMatchObject({
    space: 'B',
    phase: 'loading',
    remainingMs: 15000,
  });
});
it('does not count stalls and allows manual join without a working preview', async () => {
  const { controller, time, join } = setup();
  const generation = controller.activate('space', true);
  controller.progress(generation, 0);
  time(20000);
  controller.progress(generation, 1);
  expect(controller.getSnapshot().remainingMs).toBe(15000);
  controller.fail(generation, new Error('unavailable'));
  await controller.join();
  expect(join).toHaveBeenCalledExactlyOnceWith('space');
});
it('honors disabled auto-join and cancels a pending handoff when the card changes', async () => {
  const { controller, time, join, stop } = setup();
  const generation = controller.activate('A', false);
  for (let i = 0; i <= 80; i++) {
    time(i * 250);
    controller.progress(generation, i / 4);
  }
  expect(join).not.toHaveBeenCalled();
  let release!: () => void;
  stop.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const work = controller.join();
  controller.suspend();
  controller.activate('B', true);
  release();
  await work;
  expect(join).not.toHaveBeenCalled();
});

it('manual entry releases HLS before directly joining RTC without a PreJoin step', async () => {
  const stop = vi.fn(async () => {});
  const join = vi.fn(async () => { expect(stop).toHaveBeenCalledOnce(); });
  const c = createPreviewController({ now: Date.now, stop, join });
  c.activate('new-space', true);
  await c.join();
  expect(join).toHaveBeenCalledWith('new-space');
});
