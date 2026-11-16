/** A native dialog can report background and resolve before AppState returns to active. */
export function createSystemInteractionGuard() {
  let pending = 0;
  let settling: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    active: () => pending > 0 || settling !== undefined,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async run<T>(operation: () => Promise<T>): Promise<T> {
      pending++;
      clearTimeout(settling);
      settling = undefined;
      notify();
      try {
        return await operation();
      } finally {
        pending--;
        if (!pending) {
          settling = setTimeout(() => {
            settling = undefined;
            notify();
          }, 1500);
        }
        notify();
      }
    },
  };
}
export const systemInteraction = createSystemInteractionGuard();
