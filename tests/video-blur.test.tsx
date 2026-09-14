import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useVideoBlur } from '@/lib/hooks';

it('updates blur from element dimensions and removes observer, metadata handler and pending animation', () => {
  vi.useFakeTimers();
  const element = document.createElement('video');
  Object.defineProperties(element, { clientWidth: { value: 400 }, clientHeight: { value: 200 } });
  const add = vi.spyOn(element, 'addEventListener');
  const remove = vi.spyOn(element, 'removeEventListener');
  const observers: { callback: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn();
    observe = vi.fn();
    constructor(callback: () => void) { observers.push({ callback, disconnect: this.disconnect }); }
  });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame');
  const videoRef = { current: element };
  const { result, unmount } = renderHook(() => useVideoBlur({ videoRef, initialBlur: 0.5 }));
  act(() => element.dispatchEvent(new Event('loadedmetadata')));
  act(() => vi.advanceTimersByTime(100));
  expect(result.current.dimensions).toEqual({ width: 400, height: 200 });
  expect(result.current.blurValue).toBe(10);
  observers.at(-1)!.callback();
  unmount();
  expect(observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true);
  expect(cancel).toHaveBeenCalled();
  for (const [name, handler] of add.mock.calls) expect(remove).toHaveBeenCalledWith(name, handler);
  expect(vi.getTimerCount()).toBe(0);
});

it('still supports metadata updates when ResizeObserver is unavailable', () => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', undefined);
  const videoRef = { current: document.createElement('video') };
  const { result } = renderHook(() => useVideoBlur({ videoRef }));
  act(() => videoRef.current.dispatchEvent(new Event('loadedmetadata')));
  act(() => vi.advanceTimersByTime(100));
  expect(result.current.dimensions).toEqual({ width: 120, height: 100 });
});
