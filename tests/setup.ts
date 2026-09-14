import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  // Cleanup before restoring timers so unmount clears the timer implementation it created.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
