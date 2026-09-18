import type { Socket } from 'socket.io-client';

/** Own only these listeners; disposing one surface must not unsubscribe another. */
export function createSocketScope(socket: Pick<Socket, 'on' | 'off'>) {
  const disposers: (() => void)[] = [];
  return {
    on(event: string, listener: (...args: any[]) => void) {
      socket.on(event, listener);
      disposers.push(() => socket.off(event, listener));
    },
    dispose() {
      disposers.splice(0).forEach((dispose) => dispose());
    },
  };
}
