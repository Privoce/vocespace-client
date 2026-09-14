import { StrictMode } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BeforeUnloadGuard from '@/app/BeforeUnloadGuard';
import { clearUnloadAttempt, hasUnloadAttempt } from '@/features/room/leave-intent';

function attemptUnload() {
  const event = new Event('beforeunload', { cancelable: true });
  fireEvent(window, event);
  return event;
}

beforeEach(clearUnloadAttempt);

describe('BeforeUnloadGuard current browser-exit behavior', () => {
  it('requests confirmation and records an unload attempt when enabled', () => {
    render(<BeforeUnloadGuard />);
    expect(attemptUnload().defaultPrevented).toBe(true);
    expect(hasUnloadAttempt()).toBe(true);
  });

  it('does not intercept leaving when disabled', () => {
    render(<BeforeUnloadGuard enabled={false} />);
    expect(attemptUnload().defaultPrevented).toBe(false);
    expect(hasUnloadAttempt()).toBe(false);
  });

  it.each(['focus', 'pageshow'])('clears a cancelled attempt on visible %s', (event) => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    render(<BeforeUnloadGuard />);
    attemptUnload();
    fireEvent(window, new Event(event));
    expect(hasUnloadAttempt()).toBe(false);
  });

  it('keeps the attempt while hidden, then clears it when the page is visible', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    render(<BeforeUnloadGuard />);
    attemptUnload();
    visibility.mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    expect(hasUnloadAttempt()).toBe(true);
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    expect(hasUnloadAttempt()).toBe(false);
  });

  it('removes interception when toggled off and reinstalls it when toggled on', () => {
    const view = render(<BeforeUnloadGuard />);
    attemptUnload();
    view.rerender(<BeforeUnloadGuard enabled={false} />);
    expect(hasUnloadAttempt()).toBe(false);
    expect(attemptUnload().defaultPrevented).toBe(false);
    view.rerender(<BeforeUnloadGuard />);
    expect(attemptUnload().defaultPrevented).toBe(true);
  });

  it('leaves no unload handler after StrictMode mount and unmount', () => {
    const view = render(<StrictMode><BeforeUnloadGuard /></StrictMode>);
    expect(attemptUnload().defaultPrevented).toBe(true);
    view.unmount();
    expect(hasUnloadAttempt()).toBe(false);
    expect(attemptUnload().defaultPrevented).toBe(false);
    expect(hasUnloadAttempt()).toBe(false);
  });
});
