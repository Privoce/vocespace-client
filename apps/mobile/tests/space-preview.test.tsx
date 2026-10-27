import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  app: undefined as ((state: string) => void) | undefined,
  events: new Map<string, (event: any) => void>(),
  player: {
    replaceAsync: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(),
    pause: vi.fn(),
    playing: true,
    status: 'readyToPlay',
    muted: true,
    addListener: vi.fn(),
  },
}));
vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, callback: (state: string) => void) => {
      fake.app = callback;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock('expo-video', () => ({ useVideoPlayer: () => fake.player }));
import { useSpacePreview } from '../src/conference/hooks/useSpacePreview';
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  fake.events.clear();
  fake.player.replaceAsync.mockResolvedValue(undefined);
  fake.player.addListener.mockImplementation((event, listener) => {
    fake.events.set(event, listener);
    return { remove: () => fake.events.delete(event) };
  });
});
afterEach(() => vi.useRealTimers());
function setup() {
  const preview = vi.fn().mockResolvedValue({
    status: 'ready',
    leaseId: 'lease',
    url: 'https://api.test/preview/live.m3u8',
  });
  const releasePreview = vi.fn().mockResolvedValue(undefined);
  const renewPreview = vi.fn().mockResolvedValue(undefined);
  const join = vi.fn().mockResolvedValue(undefined);
  const model = { preview, releasePreview, renewPreview } as unknown as Parameters<
    typeof useSpacePreview
  >[0]['model'];
  const hook = renderHook(
    ({ space, active }) =>
      useSpacePreview({
        model,
        space,
        active,
        preferences: { autoJoin: true, previewMuted: true, nickname: 'Guest' },
        join,
      }),
    { initialProps: { space: 'A', active: true } },
  );
  return { ...hook, preview, releasePreview, join };
}
it('waits for a rendered frame, then joins after 10 seconds and unloads HLS before the join', async () => {
  const { result, join, releasePreview, unmount } = setup();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  await act(async () => {
    fake.events.get('timeUpdate')?.({ currentTime: 30 });
  });
  expect(result.current.state.phase).toBe('loading');
  act(() => result.current.firstFrame());
  for (let i = 0; i <= 40; i++)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      fake.events.get('timeUpdate')?.({ currentTime: 30 + i / 4 });
    });
  expect(join).toHaveBeenCalledExactlyOnceWith('A');
  expect(fake.player.replaceAsync).toHaveBeenLastCalledWith(null);
  expect(releasePreview).toHaveBeenCalledWith('lease');
  unmount();
});
it('discards delayed A leases during A→B navigation and aborts playback/countdown on background', async () => {
  const { preview, releasePreview, rerender, result, join, unmount } = setup();
  let finish!: (value: unknown) => void;
  preview.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  const signal = preview.mock.calls[0][1] as AbortSignal;
  rerender({ space: 'B', active: true });
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish({ status: 'ready', leaseId: 'old', url: 'https://old.test/a.m3u8' });
  });
  expect(releasePreview).toHaveBeenCalledWith('old');
  expect(
    fake.player.replaceAsync.mock.calls.some(([source]) => source?.uri?.includes('old.test')),
  ).toBe(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
    result.current.firstFrame();
  });
  act(() => fake.app?.('background'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(join).not.toHaveBeenCalled();
  expect(result.current.state.phase).toBe('idle');
  unmount();
});
it('keeps unavailable previews manual and cancels before a short swipe can start a source', async () => {
  const { preview, result, rerender, join, unmount } = setup();
  rerender({ space: 'A', active: false });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(preview).not.toHaveBeenCalled();
  preview.mockResolvedValue({ status: 'unavailable' });
  rerender({ space: 'A', active: true });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(16000);
  });
  expect(join).not.toHaveBeenCalled();
  await act(async () => {
    result.current.join();
  });
  expect(join).toHaveBeenCalledExactlyOnceWith('A');
  unmount();
});

it('releases a playing preview and prevents delayed auto-join when the meeting tab is hidden', async () => {
  const { result, rerender, releasePreview, join, unmount } = setup();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  act(() => result.current.firstFrame());
  await act(async () => {
    fake.events.get('timeUpdate')?.({ currentTime: 0 });
    await vi.advanceTimersByTimeAsync(250);
    fake.events.get('timeUpdate')?.({ currentTime: 0.25 });
  });
  expect(result.current.state.phase).toBe('playing');
  await act(async () => {
    rerender({ space: 'A', active: false });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20000);
  });
  expect(releasePreview).toHaveBeenCalledWith('lease');
  expect(fake.player.replaceAsync).toHaveBeenLastCalledWith(null);
  expect(join).not.toHaveBeenCalled();
  expect(result.current.state.phase).toBe('idle');
  unmount();
});
