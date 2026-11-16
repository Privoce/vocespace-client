/** RN's abort-controller lacks AbortSignal.any; detach listeners when requests finish. */
export function combineAbortSignals(signals: (AbortSignal | undefined)[]) {
  const controller = new AbortController();
  const sources = [...new Set(signals.filter((signal): signal is AbortSignal => !!signal))];
  const abort = () => controller.abort();
  for (const signal of sources) signal.addEventListener('abort', abort);
  if (sources.some((signal) => signal.aborted)) abort();
  return {
    signal: controller.signal,
    dispose: () => sources.forEach((signal) => signal.removeEventListener('abort', abort)),
  };
}
