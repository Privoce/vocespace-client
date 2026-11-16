import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSystemInteractionGuard } from '../src/ui/system-interaction';
import { createConferenceBackgroundPolicy } from '../src/conference/background-policy';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it('checks the live publication before leaving when the media snapshot has not caught up', () => {
  const leave = vi.fn();
  const suspend = vi.fn().mockResolvedValue(undefined);
  const media = { getSnapshot: () => ({ screen: false }), isScreenSharing: () => true,
    suspendCameraAndMicrophone: suspend };
  const policy = createConferenceBackgroundPolicy({ background: () => true,
    systemInteraction: () => false, media: () => media as any, leave });
  policy.check();
  expect(leave).not.toHaveBeenCalled();
  expect(suspend).toHaveBeenCalledOnce();
  policy.dispose();
});
function fixture() {
  const guard = createSystemInteractionGuard();
  let background = false;
  const state = { screen: false, busy: undefined as string | undefined };
  const leave = vi.fn().mockResolvedValue(undefined);
  const suspend = vi.fn().mockResolvedValue(undefined);
  const media = { isScreenSharing: () => state.screen, getSnapshot: () => state, suspendCameraAndMicrophone: suspend };
  const policy = createConferenceBackgroundPolicy({
    background: () => background,
    systemInteraction: guard.active,
    media: () =>
      media as unknown as NonNullable<
        ReturnType<Parameters<typeof createConferenceBackgroundPolicy>[0]['media']>
      >,
    leave,
  });
  guard.subscribe(policy.check);
  return {
    guard,
    state,
    leave,
    suspend,
    policy,
    background(value: boolean) {
      background = value;
      policy.check();
    },
  };
}
it.each(['microphone', 'camera', 'screen', 'image', 'file'])(
  'keeps the meeting through %s system UI and media updates before foreground returns',
  async (kind) => {
    const f = fixture();
    let finish!: () => void;
    const operation = f.guard.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    f.background(true);
    f.state.busy = kind;
    f.policy.check();
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.leave).not.toHaveBeenCalled();
    f.state.busy = undefined;
    f.policy.check();
    finish();
    await operation;
    expect(f.leave).not.toHaveBeenCalled();
    f.background(false);
    await vi.advanceTimersByTimeAsync(1500);
    expect(f.guard.active()).toBe(false);
    expect(f.leave).not.toHaveBeenCalled();
    // A later real Home gesture must still exit normally.
    f.background(true);
    expect(f.leave).toHaveBeenCalledOnce();
  },
);
it('exits if a cancelled/failed picker finishes and the app really stays in background', async () => {
  const f = fixture();
  await expect(
    f.guard.run(async () => {
      f.background(true);
      throw new Error('denied');
    }),
  ).rejects.toThrow('denied');
  await vi.advanceTimersByTimeAsync(1500);
  expect(f.leave).toHaveBeenCalledOnce();
});
it('keeps a started broadcast and suspends other media once, then exits when broadcasting stops', async () => {
  const f = fixture();
  await f.guard.run(async () => {
    f.background(true);
    f.state.screen = true;
  });
  await vi.advanceTimersByTimeAsync(1500);
  f.policy.check();
  expect(f.suspend).toHaveBeenCalledOnce();
  expect(f.leave).not.toHaveBeenCalled();
  f.state.screen = false;
  f.policy.check();
  expect(f.leave).toHaveBeenCalledOnce();
});
it('does not release overlapping dialogs early or run a disposed meeting policy', async () => {
  const f = fixture();
  let finish!: () => void;
  const pending = f.guard.run(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await f.guard.run(async () => {});
  f.background(true);
  await vi.advanceTimersByTimeAsync(2000);
  expect(f.guard.active()).toBe(true);
  f.policy.dispose();
  finish();
  await pending;
  await vi.advanceTimersByTimeAsync(1500);
  expect(f.guard.active()).toBe(false);
  expect(f.leave).not.toHaveBeenCalled();
});
