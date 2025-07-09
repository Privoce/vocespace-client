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

// [args] ---------------------------------------------------------------------------------------------------------------
const {
  NODE_ENV = 'production',
  HOST: hostname = 'localhost',
  PORT = '3000',
  NEXT_PUBLIC_BASE_PATH: basePath = '',
} = process.env;
const dev = NODE_ENV !== 'production';
const port = parseInt(PORT, 10) || 3000;

console.log(`env: {
  NODE_ENV: ${dev},
  HOST: ${hostname},
  PORT: ${port},
  NEXT_PUBLIC_BASE_PATH: ${basePath}
}`);
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
  // [io on] -------------------------------------------------------------------------------------------------------------
  // - [io connection] ---------------------------------------------------------------------------------------------------
  io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);
    // - [socket: wave hand event to other user] -------------------------------------------------------------------------
    // - on: "wave"
    // - emit: "wave_response"
    // - msg: { room: string, senderId: string, senderName: string, receiverId: string }
    socket.on('wave', (msg) => {
      console.log('wave', msg);
      socket.to(msg.socketId).emit('wave_response', {
        room: msg.room,
        senderId: msg.senderId,
        senderName: msg.senderName,
        receiverId: msg.receiverId,
      });
    });
    // [socket: update user status event] --------------------------------------------------------------------------------
    // - on: "update_user_status"
    // - emit: "user_status_updated"
    // - msg: _
    socket.on('update_user_status', () => {
      socket.broadcast.emit('user_status_updated');
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
      console.log('chat_msg', msg);
      socket.broadcast.emit('chat_msg_response', msg);
    });
    // [socket: chat file event] ----------------------------------------------------------------------------------------
    socket.on('chat_file', async (msg) => {
      try {
        const { file, sender, roomName } = msg;
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
          timestamp: Date.now(),
          type: 'file',
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            url: fileUrl,
          },
        };

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
    // [socket: clear room resources] -----------------------------------------------------------------------------------------
    socket.on('clear_room_resources', async (msg) => {
      const { roomName } = msg;
      // 删除uploads下的对应roomName的文件夹
      const roomDir = path.join(uploadDir, roomName);
      if (fs.existsSync(roomDir)) {
        fs.rmdirSync(roomDir, { recursive: true });
      }
    });
    // [socket: create a new user status] ------------------------------------------------------------------------------------
    socket.on('new_user_status', (msg) => {
      io.emit('new_user_status_response', msg);
    });
    // [socket: new user] ----------------------------------------------------------------------------------------------------
    socket.on('disconnect', (msg) => {
      console.log('Socket disconnected', socket.id);
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
