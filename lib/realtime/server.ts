import type { Server } from 'socket.io';
import type { WsParticipant } from '../std/device';

declare global {
  var vocespaceSocketServer: Server | undefined;
}

/** The custom Node server owns broadcasting; API routes do not create clients. */
export function notifyParticipantReinit(participant: WsParticipant) {
  if (!globalThis.vocespaceSocketServer) {
    throw new Error('Socket.IO server is unavailable; start the app with server.js');
  }
  globalThis.vocespaceSocketServer.emit('re_init_response', participant);
}
