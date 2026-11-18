import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  player: {
    bufferOptions: {} as any,
    replaceAsync: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));
vi.mock('../src/analytics', () => ({ analytics: { track: vi.fn() } }));
vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock('expo-video', () => ({
  useVideoPlayer: (_source: unknown, initialize: (player: unknown) => void) => {
    initialize(fake.player);
    return fake.player;
  },
}));
import { useSpacePreview } from '../src/conference/hooks/useSpacePreview';
const model = { preview: vi.fn(), releasePreview: vi.fn(), renewPreview: vi.fn() };
const preferences = { autoJoin: false, previewMuted: true } as any;
const join = vi.fn();
const ready = { status: 'ready', leaseId: 'lease', url: 'https://test.invalid/live.m3u8' };
beforeEach(() => {
  vi.useFakeTimers();
  fake.player.replaceAsync.mockReset().mockResolvedValue(undefined);
  model.preview.mockReset();
  model.releasePreview.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => cleanup());
  vi.useRealTimers();
});
it('polls a starting encoder every second and plays as soon as a lease is ready', async () => {
  model.preview.mockResolvedValueOnce({ status: 'starting' }).mockResolvedValue(ready);
  renderHook(() =>
    useSpacePreview({ model: model as any, preferences, space: 'demo', active: true, join }),
  );
  expect(fake.player.bufferOptions).toEqual({
    preferredForwardBufferDuration: 5,
    waitsToMinimizeStalling: false,
    minBufferForPlayback: 1,
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(model.preview).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(fake.player.replaceAsync).toHaveBeenCalledWith({
    uri: ready.url,
    contentType: 'hls',
    useCaching: false,
  });
  expect(fake.player.play).toHaveBeenCalled();
  expect(join).not.toHaveBeenCalled();
});
it('releases a late lease after leaving the preview without starting playback', async () => {
  let finish!: (value: unknown) => void;
  model.preview.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = renderHook(
    ({ active }) =>
      useSpacePreview({ model: model as any, preferences, space: 'demo', active, join }),
    { initialProps: { active: true } },
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  await act(async () => view.rerender({ active: false }));
  expect(model.preview.mock.calls[0][1].aborted).toBe(true);
  await act(async () => finish(ready));
  expect(model.releasePreview).toHaveBeenCalledWith('lease');
  expect(fake.player.replaceAsync).not.toHaveBeenCalledWith(
    expect.objectContaining({ uri: ready.url }),
  );
});
