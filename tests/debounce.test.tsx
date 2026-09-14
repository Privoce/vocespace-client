import { StrictMode, type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from '@/lib/hooks/timing';

const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;

beforeEach(() => vi.useFakeTimers());

describe('useDebounce lifecycle baseline', () => {
  it('returns the initial value without waiting', () => {
    const { result } = renderHook(() => useDebounce('initial', 100), { wrapper });
    expect(result.current).toBe('initial');
  });

  it('publishes only the latest value after its quiet period', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: 'initial' }, wrapper,
    });
    rerender({ value: 'first' });
    act(() => vi.advanceTimersByTime(80));
    rerender({ value: 'latest' });
    act(() => vi.advanceTimersByTime(99));
    expect(result.current).toBe('initial');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('latest');
  });

  it('reschedules a pending update when the delay changes', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 100 }, wrapper,
    });
    rerender({ value: 'next', delay: 100 });
    act(() => vi.advanceTimersByTime(50));
    rerender({ value: 'next', delay: 200 });
    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe('initial');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('next');
  });

  it('cancels pending work when the owner unmounts', () => {
    const before = vi.getTimerCount();
    const { rerender, unmount } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: 'initial' }, wrapper,
    });
    rerender({ value: 'next' });
    expect(vi.getTimerCount()).toBe(before + 1);
    unmount();
    expect(vi.getTimerCount()).toBe(before);
  });
});
