import type { AnalyticsLeaveReason } from '@vocespace/contracts';
/** Repeated taps share one prompt; recheck the session after the asynchronous choice. */
export function createLeaveGuard(ports: {
  current(): object | undefined;
  protected(): boolean;
  confirm(): Promise<boolean>;
  leave(reason?: AnalyticsLeaveReason): Promise<boolean>;
}) {
  let flight: Promise<boolean> | undefined;
  return (reason: AnalyticsLeaveReason = 'user') => {
    if (flight) return flight;
    const room = ports.current();
    flight = (async () => {
      if (ports.protected() && !(await ports.confirm())) return false;
      if (ports.current() !== room) return false;
      return ports.leave(reason);
    })().finally(() => {
      flight = undefined;
    });
    return flight;
  };
}
