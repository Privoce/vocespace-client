let socketServer = null;

export const setSocketServer = (io) => {
  socketServer = io;
};

export const getSocketServer = () => socketServer;
