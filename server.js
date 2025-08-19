/**
 * @description: This is a simple Node.js server using Express and Socket.IO to handle real-time communication and file uploads.
 * @author: Will Sheng
 */
import dotenv from 'dotenv';
import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __cfg = path.dirname(__filename);

// Load environment files in order of priority
const envFiles = ['.env.local', '.env.development', '.env'];

envFiles.forEach((file) => {
  const envPath = path.join(__cfg, file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
});

export const getRedisConfig = () => {
  try {
    const configPath = path.join(__cfg, 'vocespace.conf.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    console.log('Redis config loaded -----------------');
    return {
      REDIS_ENABLED: config.redis.enabled || 'false',
      REDIS_HOST: config.redis.host || 'localhost',
      REDIS_PORT: config.redis.port || '6379',
      REDIS_PASSWORD: config.redis.password || '',
      REDIS_DB: config.redis.db || '0',
    };
  } catch (error) {
    return {
      REDIS_ENABLED: 'false',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: '',
      REDIS_DB: '0',
    };
  }
};

// [args] ---------------------------------------------------------------------------------------------------------------
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = process.env.PORT || 3000;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const { REDIS_ENABLED, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB } = getRedisConfig();

console.log(`env: {
    REDIS_ENABLED: ${REDIS_ENABLED}
    REDIS_HOST: ${REDIS_HOST}
    REDIS_PORT: ${REDIS_PORT}
    REDIS_PASSWORD: ${REDIS_PASSWORD || 'not set'}
    REDIS_DB: ${REDIS_DB}
}`);

let redisClient = null;

// [build redis client] --------------------------------------------------------
if (REDIS_ENABLED === 'true') {
  let host = REDIS_HOST;
  let port = parseInt(REDIS_PORT, 10);
  let db = parseInt(REDIS_DB, 10);

  try {
    redisClient = new Redis({
      host,
      port,
      password: REDIS_PASSWORD,
      db,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
    });

    // 添加错误处理
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('Redis ready');
    });

    redisClient.on('close', () => {
      console.log('Redis connection closed');
    });
  } catch (error) {
    console.error('Failed to create Redis client:', error);
    redisClient = null;
  }
}

// redis chat manager, use to store room chat messages into redis see interface [std.chat.ChatMsgItem]
class ChatManager {
  static CHAT_KEY_PREFIX = 'chat:';

  static getChatKey(roomName) {
    return `${this.CHAT_KEY_PREFIX}${roomName}`;
  }

  // delete chat messages from redis
  static async deleteChatMessages(room) {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized');
      }
      const chatKey = this.getChatKey(room);
      // Delete the chat key from Redis
      const exists = await redisClient.exists(chatKey);
      if (exists) {
        await redisClient.del(chatKey);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting chat messages from Redis:', error);
      return false;
    }
  }

  // get chat messages from redis
  static async getChatMessages(room) {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized');
      }
      const chatKey = this.getChatKey(room);
      const messages = await redisClient.get(chatKey);
      if (!messages) {
        return [];
      }
      return JSON.parse(messages);
    } catch (error) {
      console.error('Error getting chat messages from Redis:', error);
      return [];
    }
  }

  // set/push chat message to redis
  static async setChatMessage(room, msg) {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized');
      }
      const msgs = await this.getChatMessages(room);
      msgs.push(msg);
      const chatKey = this.getChatKey(room);
      // Store the messages as a JSON string
      await redisClient.set(chatKey, JSON.stringify(msgs));
      return true;
    } catch (error) {
      console.error('Error setting chat message to Redis:', error);
      return false;
    }
  }
}

// [when using middleware `hostname` and `port` must be provided below] -------------------------------------------------
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// upload dir path
const uploadDir = path.join(__dirname, 'uploads');
// check if upload dir exists, if not create it
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// [app server launch] ---------------------------------------------------------------------------------------------------
app.prepare().then(() => {
  const server = express();
  server.use(`${basePath}/uploads`, express.static(path.join(__dirname, 'uploads')));

  server.use((req, res) => {
    return handler(req, res);
  });
  const httpServer = createServer(server);

  const io = new Server(httpServer);
  const processingSocketIds = new Set();
  // [io on] -------------------------------------------------------------------------------------------------------------
  // - [io connection] ---------------------------------------------------------------------------------------------------
  io.on('connection', (socket) => {
    // - [socket: wave hand event to other user] -------------------------------------------------------------------------
    // - on: "wave"
    // - emit: "wave_response"
    // - msg: { room: string, senderId: string, senderName: string, receiverId: string, socketId: string } see [`std::WsTo`]
    socket.on('wave', (msg) => {
      socket.to(msg.socketId).emit('wave_response', msg);
    });
    socket.on('raise_hand', (msg) => {
      // 广播给处了自己外所有人
      socket.broadcast.emit('raise_hand_response', msg);
    });
    // [socket: remove participant event] -------------------------------------------------------------------------------
    // - on: "remove_participant"
    // - emit: "remove_participant_response"
    // - msg: { room: string, senderId: string, senderName: string, receiverId: string, socketId: string } see [`std::WsTo`]
    socket.on('remove_participant', (msg) => {
      socket.to(msg.socketId).emit('remove_participant_response', msg);
    });
    // [socket: invite open device event] --------------------------------------------------------------------------------
    // - on: "invite_device"
    // - emit: "invite_device_response"
    // - msg: {
    //    room: string,
    //    socketId: string,
    //    senderId: string,
    //    senderName: string,
    //    receiverId: string,
    //    device: "camera" | "microphone" | "screen_share" see [`Track.Source`]
    // } see [`std::WsInviteDevice`]
    socket.on('invite_device', (msg) => {
      socket.to(msg.socketId).emit('invite_device_response', msg);
    });
    // [socket: ask host to record room] ---------------------------------------------------------------------------------
    // - on: "req_record"
    // - emit: "req_record_response"
    // - msg: see [`std::WsReqHost` extends [`std::WsTo`]]
    socket.on('req_record', (msg) => {
      socket.to(msg.socketId).emit('req_record_response', msg);
    });
    // [socket: ask other participant to record room] --------------------------------------------------------------------
    // - on: "recording"
    // - emit: "recording_response"
    // - msg: {room: string}
    socket.on('recording', (msg) => {
      socket.broadcast.emit('recording_response', msg);
    });
    // [socket: control participant event] -------------------------------------------------------------------------------
    // - on: "control_participant"
    // - emit: "control_participant_response"
    // - msg: see [`std::WsControlParticipant`]
    socket.on('control_participant', (msg) => {
      socket.to(msg.socketId).emit('control_participant_response', msg);
    });
    // [socket: update user status event] --------------------------------------------------------------------------------
    // - on: "update_user_status"
    // - emit: "user_status_updated"
    // - msg: see [`std::WsBase`]
    socket.on('update_user_status', (msg) => {
      // socket.broadcast.emit('user_status_updated', msg);
      io.emit('user_status_updated', msg);
    });
    // [socket: refetch room] --------------------------------------------------------------------------------------------
    // - on: "refetch_room"
    // - emit: "refetch_room_response"
    socket.on('refetch_room', (msg) => {
      // 广播给所有用户包括自己
      io.emit('refetch_room_response', msg);
    });
    // [socket: mouse move event] ----------------------------------------------------------------------------------------
    // - on: "mouse_move"
    // - emit: "mouse_move_response"
    // - msg: {
    //     room: string | undefined;
    //     x: number;
    //     y: number;
    //     color: string;
    //     senderName: string;
    //     senderId: string;
    //     receiverId: string;
    //     receSocketId: string;
    //     realVideoRect: {
    //         width: number;
    //         height: number;
    //         left: number;
    //         top: number;
    //     };
    // }
    socket.on('mouse_move', (msg) => {
      socket.broadcast.emit('mouse_move_response', msg);
    });
    // [socket: mouse click event] -------------------------------------------------------------------------------------
    // - on: "mouse_click"
    // - emit: "mouse_click_response"
    // - msg: {
    //   room: string;
    //   senderName: string;
    //   senderId: string;
    //   receiverId: string;
    //   receSocketId: string;
    // }
    socket.on('mouse_remove', (msg) => {
      socket.broadcast.emit('mouse_remove_response', msg);
    });
    // [socket: chat message event] -------------------------------------------------------------------------------------
    socket.on('chat_msg', (msg) => {
      // store in redis
      ChatManager.setChatMessage(msg.roomName, msg);
      socket.broadcast.emit('chat_msg_response', msg);
    });
    // [socket: chat file event] ----------------------------------------------------------------------------------------
    socket.on('chat_file', async (msg) => {
      try {
        const { file, sender, roomName, timestamp } = msg;
        const fileId = Date.now().toString();
        const fileExt = path.extname(file.name);
        const fileName = `${fileId}${fileExt}`;
        const dirPath = path.join(uploadDir, roomName);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(uploadDir, roomName, fileName);
        console.log('filePath', filePath);
        // 处理文件数据
        let fileData;
        if (file.data.startsWith('data:')) {
          // 处理 base64 数据
          const base64Data = file.data.split(',')[1];
          fileData = Buffer.from(base64Data, 'base64');
        } else {
          // 处理二进制数据
          fileData = Buffer.from(file.data);
        }

        // 保存文件
        fs.writeFileSync(filePath, fileData);

        // 文件URL (根据实际部署情况调整)
        const fileUrl = `${basePath}/uploads/${roomName}/${fileName}`;

        // 广播文件消息
        const fileMessage = {
          id: fileId,
          sender: {
            id: sender.id,
            name: sender.name,
          },
          roomName,
          message: `文件: ${file.name}`,
          timestamp: timestamp || Date.now(),
          type: 'file',
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            url: fileUrl,
          },
        };
        // store in redis
        ChatManager.setChatMessage(roomName, fileMessage);
        io.emit('chat_file_response', fileMessage);
      } catch (error) {
        console.error('文件处理失败', error);
        socket.emit('error', { message: '文件处理失败' });
      }
    });
    // [socket: reload when virtual role change] ------------------------------------------------------------------------------
    socket.on('reload_virtual', (msg) => {
      socket.broadcast.emit('reload_virtual_response', msg);
    });
    // [socket: clear space resources] -----------------------------------------------------------------------------------------
    socket.on('clear_space_resources', async (msg) => {
      const { spaceName } = msg;
      // 删除uploads下的对应spaceName的文件夹
      const spaceDir = path.join(uploadDir, spaceName);
      if (fs.existsSync(spaceDir)) {
        fs.rmdirSync(spaceDir, { recursive: true });
      }
      // delete chat messages from redis
      await ChatManager.deleteChatMessages(spaceName);
    });
    // [socket: create a new user status] ------------------------------------------------------------------------------------
    socket.on('new_user_status', (msg) => {
      io.emit('new_user_status_response', msg);
    });
    // [socket: join privacy room] ------------------------------------------------------------------------------------------
    socket.on('join_privacy_room', (msg) => {
      socket.to(msg.socketId).emit('join_privacy_room_response', msg);
    });
    // [socket: remove from room] ----------------------------------------------------------------------------------------
    // let room users know that thay are cleared by host
    socket.on('removed_from_privacy_room', (msg) => {
      // socket.broadcast.emit('removed_from_privacy_room_response', msg);
      msg.socketIds.forEach((socketId) => {
        socket.to(socketId).emit('removed_from_privacy_room_response', msg);
      });
    });
    // [socket: reload env conf] -----------------------------------------------------------------------------------------
    // 重新加载环境配置, 通知所有用户重载
    socket.on('reload_env', (msg) => {
      // 广播给所有用户包括自己
      io.emit('reload_env_response', msg);
    });
    // [socket: re init participant] --------------------------------------------------------------------------------
    // 由服务器端触发，重新初始化某个用户的状态，依靠msg中的room进行判断，无法使用socket.id
    // - msg: WsParticipant
    socket.on('re_init', (msg) => {
      io.emit('re_init_response', msg);
    });
    // [socket: del user] ----------------------------------------------------------------------------------------------------
    socket.on('disconnect', async (_reason) => {
      console.log('Socket disconnected', socket.id);

      if (processingSocketIds.has(socket.id)) {
        return;
      }

      processingSocketIds.add(socket.id);

      try {
        // 增加一个延迟，避免在socket重连时立即删除数据 (5s, 因为一次重连1s，设置了5次重连)
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const isReconnected = io.sockets.sockets.has(socket.id);
        if (isReconnected) {
          // 重连成功
          return;
        }

        // 当某个用户断开连接我们需要请求http服务器删除用户在房间中的数据
        if (socket.id) {
          const url = `http://${hostname}:${port}${basePath}/api/space?socketId=${socket.id}`;
          const response = await fetch(url.toString(), {
            method: 'DELETE',
          });
          if (!response.ok) {
            console.error('Failed to delete user data, socketId:', socket.id);
          } else {
            // 如果成功，就要让其他用户更新
            setTimeout(() => {
              io.emit('user_status_updated');
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Error processing socket disconnect:', error);
      } finally {
        setTimeout(() => {
          processingSocketIds.delete(socket.id);
        }, 5000);
      }
    });
  });
  // [http server] ----------------------------------------------------------------------------------------------------------
  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}${basePath}`);
    });
});
