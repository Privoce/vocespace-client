// types/global.d.ts
import { Server as SocketServer } from 'socket.io';

declare global {
  var serverSocketIO: SocketServer | null;
}

export {};
