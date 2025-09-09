// lib/server/socket.ts
import { Server as SocketServer } from 'socket.io';
import { WsBase } from '@/lib/std/device';

// 声明全局变量类型
declare global {
  var serverSocketIO: SocketServer | null;
}

/**
 * 获取服务端 Socket.IO 实例
 */
export function getServerSocketIO(): SocketServer | null {
  return global.serverSocketIO || null;
}

/**
 * 发送更新用户状态的广播
 * 用于替代客户端 socket.emit 调用
 */
export function emitUpdateUserStatus(data: WsBase) {
  const serverSocketIO = getServerSocketIO();
  if (serverSocketIO) {
    serverSocketIO.emit('update_user_status', data);
    return true;
  } else {
    console.warn('Server Socket.IO instance not available for broadcast');
    return false;
  }
}

/**
 * 通用的服务端事件发射器
 */
export function emitServerEvent(eventName: string, data: any) {
  const serverSocketIO = getServerSocketIO();
  if (serverSocketIO) {
    serverSocketIO.emit(eventName, data);
    return true;
  } else {
    console.warn(`Server Socket.IO instance not available for event: ${eventName}`);
    return false;
  }
}
