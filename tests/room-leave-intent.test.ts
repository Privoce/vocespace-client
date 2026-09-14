import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearExplicitLeaveIntent,
  clearUnloadAttempt,
  consumeExplicitLeaveIntent,
  hasUnloadAttempt,
  markExplicitLeaveIntent,
  markUnloadAttempt,
} from '@/features/room/leave-intent';

beforeEach(() => {
  clearExplicitLeaveIntent();
  clearUnloadAttempt();
});

describe('explicit leave and browser unload are separate decisions', () => {
  it('does not treat an unsolicited disconnect as an explicit leave', () => {
    expect(consumeExplicitLeaveIntent()).toBe(false);
  });

  it('consumes an explicit leave only once, including repeated button signals', () => {
    markExplicitLeaveIntent();
    markExplicitLeaveIntent();
    expect(consumeExplicitLeaveIntent()).toBe(true);
    expect(consumeExplicitLeaveIntent()).toBe(false);
  });

  it('allows a cancelled intent to be cleared before a later disconnect', () => {
    markExplicitLeaveIntent();
    clearExplicitLeaveIntent();
    expect(consumeExplicitLeaveIntent()).toBe(false);
  });

  it('keeps an unload attempt until cleared without marking an explicit leave', () => {
    markUnloadAttempt();
    expect(hasUnloadAttempt()).toBe(true);
    expect(consumeExplicitLeaveIntent()).toBe(false);
    expect(hasUnloadAttempt()).toBe(true);
    clearUnloadAttempt();
    expect(hasUnloadAttempt()).toBe(false);
  });
});
