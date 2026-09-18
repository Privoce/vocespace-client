import { io } from 'socket.io-client';

// Importing a view or rendering on the server must never open a connection.
export const socket = io({
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  timeout: 30000,
  transports: ['websocket', 'polling'],
});

let owners = 0;
export function retainSocket() {
  owners += 1;
  socket.connect();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owners -= 1;
    if (owners === 0) socket.disconnect();
  };
}
