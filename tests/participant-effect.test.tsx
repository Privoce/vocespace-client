import { act, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ParticipantMouseEffect } from '@/app/pages/participant/effect';

it('supports repeated enable/disable without retaining resize handlers or observers', () => {
  vi.useFakeTimers();
  const add = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  const disconnects: ReturnType<typeof vi.fn>[] = [];
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor() { disconnects.push(this.disconnect); }
  });
  const container = document.createElement('div');
  Object.defineProperties(container, { clientWidth: { value: 200 }, clientHeight: { value: 100 } });
  const props = { mappingTarget: 'avo' as const, containerRef: { current: container }, remoteCursors: {} };
  const view = render(<ParticipantMouseEffect {...props} enabled={false} />);
  expect(disconnects).toHaveLength(0);
  for (let i = 0; i < 2; i++) {
    view.rerender(<ParticipantMouseEffect {...props} enabled />);
    view.rerender(<ParticipantMouseEffect {...props} enabled={false} />);
  }
  expect(disconnects).toHaveLength(2);
  expect(disconnects.every((disconnect) => disconnect.mock.calls.length === 1)).toBe(true);
  for (const [event, handler] of add.mock.calls.filter(([event]) => event === 'resize')) {
    expect(remove).toHaveBeenCalledWith(event, handler);
  }
  expect(vi.getTimerCount()).toBe(0);
});

it('cancels retries when disabled before the media element becomes available', () => {
  vi.useFakeTimers();
  const props = { videoRef: { current: null }, remoteCursors: {} };
  const view = render(<ParticipantMouseEffect {...props} enabled />);
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  view.rerender(<ParticipantMouseEffect {...props} enabled={false} />);
  act(() => vi.advanceTimersByTime(5000));
  expect(vi.getTimerCount()).toBe(0);
});
