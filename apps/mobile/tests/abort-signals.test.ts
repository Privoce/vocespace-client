import { expect, it, vi } from 'vitest';
import { combineAbortSignals } from '../src/api/abort';

it('cancels from either owner without AbortSignal.any and releases listeners on completion', () => {
  for (const index of [0, 1]) {
    const owners = [new AbortController(), new AbortController()];
    const removals = owners.map(owner => vi.spyOn(owner.signal, 'removeEventListener'));
    const combined = combineAbortSignals(owners.map(owner => owner.signal));
    owners[index].abort();
    expect(combined.signal.aborted).toBe(true);
    combined.dispose();
    removals.forEach(remove => expect(remove).toHaveBeenCalledOnce());
  }
  const done = new AbortController(); done.abort();
  const combined = combineAbortSignals([undefined, done.signal]);
  expect(combined.signal.aborted).toBe(true);
  combined.dispose();
});
