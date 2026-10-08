import { io, type ManagerOptions, type SocketOptions } from 'socket.io-client';

export function createRealtimeClient(
  url?: string,
  options: Partial<ManagerOptions & SocketOptions> = {},
) {
  // Each caller owns its connection; importing this module cannot connect.
  return io(url, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 30000,
    transports: ['websocket', 'polling'],
    ...options,
    autoConnect: false,
    forceNew: true,
  });
}
