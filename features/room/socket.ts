import { io, type Socket } from 'socket.io-client';

const createRoomSocket = () =>
  io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 30000,
    forceNew: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

let roomSocket: Socket | null = null;

export const getRoomSocket = () => {
  if (!roomSocket) {
    roomSocket = createRoomSocket();
  }

  return roomSocket;
};

export const socket = getRoomSocket();

export const connectRoomSocket = () => {
  const instance = getRoomSocket();
  if (!instance.connected) {
    instance.connect();
  }
  return instance;
};

export const disconnectRoomSocket = () => {
  const instance = getRoomSocket();
  if (instance.connected || instance.active) {
    instance.disconnect();
  }
};
