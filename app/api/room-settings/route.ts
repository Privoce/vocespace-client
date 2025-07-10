// /app/api/room-settings/route.ts
import { UserDefineStatus } from '@/lib/std';
import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { ChatMsgItem } from '@/lib/std/chat';
import { ChildRoom, ParticipantSettings, RoomSettings } from '@/lib/std/room';

interface RoomSettingsMap {
  [roomId: string]: RoomSettings;
}

interface RoomTimeRecord {
  start: number; // 记录开始时间戳
  end?: number; // 记录结束时间戳
}

// 记录房间的使用情况
interface RoomDateRecords {
  [roomId: string]: RoomTimeRecord[];
}

// [redis config env] ----------------------------------------------------------
const {
  REDIS_ENABLED = 'false',
  REDIS_HOST = 'localhost',
  REDIS_PORT = '6379',
  REDIS_PASSWORD,
  REDIS_DB = '0',
} = process.env;

let redisClient: Redis | null = null;

// [build redis client] --------------------------------------------------------
if (REDIS_ENABLED === 'true') {
  let host = REDIS_HOST;
  let port = parseInt(REDIS_PORT, 10);
  let db = parseInt(REDIS_DB, 10);

  redisClient = new Redis({
    host,
    port,
    password: REDIS_PASSWORD,
    db,
  });
}

class RoomManager {
  // 房间 redis key 前缀
  private static ROOM_KEY_PREFIX = 'room:';
  // 参与者 redis key 前缀
  private static PARTICIPANT_KEY_PREFIX = 'room:participant:';
  // 房间列表 redis key 前缀 （房间不止一个）
  private static ROOM_LIST_KEY_PREFIX = 'room:list:';
  // 房间使用情况 redis key 前缀
  private static ROOM_DATE_RECORDS_KEY_PREFIX = 'room:date:records:';
  // 聊天记录 redis key 前缀
  private static CHAT_KEY_PREFIX = 'chat:';

  private static getChatKey(room: string): string {
    return `${this.CHAT_KEY_PREFIX}${room}`;
  }

  // room redis key, like: room:test_room
  private static getRoomKey(room: string): string {
    return `${this.ROOM_KEY_PREFIX}${room}`;
  }
  // participant redis key
  private static getParticipantKey(room: string, participantId: string): string {
    return `${this.PARTICIPANT_KEY_PREFIX}${room}:${participantId}`;
  }

  // 切换房间隐私性 ----------------------------------------------------------------------
  static async switchChildRoomPrivacy(
    room: string,
    childRoom: string,
    isPrivate: boolean,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }

      const roomSettings = await this.getRoomSettings(room);
      if (!roomSettings) {
        throw new Error(`Room ${room} does not exist.`);
      }

      // 查找子房间
      const childRoomData = roomSettings.children.find((c) => c.name === childRoom);
      if (!childRoomData) {
        throw new Error(`Child room ${childRoom} does not exist in room ${room}.`);
      }

      // 修改子房间的隐私性
      childRoomData.isPrivate = isPrivate;

      // 设置回存储
      await this.setRoomSettings(room, roomSettings);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while switching child room privacy.',
      };
    }
  }

  // 修改子房间的名字 ---------------------------------------------------------------------
  static async renameChildRoom(
    room: string,
    childRoom: string,
    newChildRoomName: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }

      const roomSettings = await this.getRoomSettings(room);
      if (!roomSettings) {
        throw new Error(`Room ${room} does not exist.`);
      }

      // 查找子房间
      const childRoomData = roomSettings.children.find((c) => c.name === childRoom);
      if (!childRoomData) {
        throw new Error(`Child room ${childRoom} does not exist in room ${room}.`);
      }

      // 检查新名字是否已经存在
      if (roomSettings.children.some((c) => c.name === newChildRoomName)) {
        return {
          success: false,
          error: `Child room with name ${newChildRoomName} already exists.`,
        };
      }

      // 修改子房间名字
      childRoomData.name = newChildRoomName;

      // 设置回存储
      await this.setRoomSettings(room, roomSettings);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while renaming child room.',
      };
    }
  }

  // 从子房间中移除参与者 ------------------------------------------------------------------
  static async removeParticipantFromChildRoom(
    room: string,
    childRoom: string,
    participantId: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }

      const roomSettings = await this.getRoomSettings(room);
      if (!roomSettings) {
        throw new Error(`Room ${room} does not exist.`);
      }

      // 查找子房间
      const childRoomData = roomSettings.children.find((c) => c.name === childRoom);
      if (!childRoomData) {
        throw new Error(`Child room ${childRoom} does not exist in room ${room}.`);
      }

      // 检查参与者是否在子房间中
      const participantIndex = childRoomData.participants.indexOf(participantId);
      if (participantIndex === -1) {
        return {
          success: false,
          error: `Participant ${participantId} is not in child room ${childRoom}.`,
        }; // 参与者不在子房间中
      }

      // 从子房间中移除参与者
      childRoomData.participants.splice(participantIndex, 1);

      // 设置回存储
      await this.setRoomSettings(room, roomSettings);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while removing participant from child room.',
      };
    }
  }

  // 向子房间添加参与者 --------------------------------------------------------------------
  static async addParticipantToChildRoom(
    room: string,
    childRoom: string,
    participantId: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }

      const roomSettings = await this.getRoomSettings(room);
      if (!roomSettings) {
        throw new Error(`Room ${room} does not exist.`);
      }

      // 查找子房间
      const childRoomData = roomSettings.children.find((c) => c.name === childRoom);
      if (!childRoomData) {
        throw new Error(`Child room ${childRoom} does not exist in room ${room}.`);
      }

      // 检查参与者是否已经在子房间中
      if (childRoomData.participants.includes(participantId)) {
        return {
          success: false,
          error: `Participant ${participantId} is already in child room ${childRoom}.`,
        }; // 参与者已经在子房间中
      }

      // 添加参与者到子房间
      childRoomData.participants.push(participantId);

      // 设置回存储
      await this.setRoomSettings(room, roomSettings);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while adding participant to child room.',
      };
    }
  }

  // 删除某个子房间 -----------------------------------------------------------------------
  static async deleteChildRoom(room: string, childRoomName: string): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomSettings = await this.getRoomSettings(room);
      if (!roomSettings) {
        throw new Error(`Room ${room} does not exist.`);
      }
      // 查找子房间
      const childRoomIndex = roomSettings.children.findIndex((c) => c.name === childRoomName);
      if (childRoomIndex === -1) {
        throw new Error(`Child room ${childRoomName} does not exist in room ${room}.`);
      }
      // 删除子房间
      roomSettings.children.splice(childRoomIndex, 1);
      // 设置回存储
      return await this.setRoomSettings(room, roomSettings);
    } catch (error) {
      console.error('Error deleting child room:', error);
      return false;
    }
  }

  // 设置新子房间 ------------------------------------------------------------------------
  static async setChildRoom(
    room: string,
    childRoom: ChildRoom,
  ): Promise<{
    error?: string;
    success: boolean;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomSettings = await this.getRoomSettings(room);
      if (!roomSettings) {
        throw new Error(`Room ${room} does not exist.`);
      }
      // 如果子房间已经存在，则不添加
      if (roomSettings.children.some((c) => c.name === childRoom.name)) {
        return {
          success: true,
        };
      }
      roomSettings.children.push(childRoom);
      await this.setRoomSettings(room, roomSettings);
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error setting child room:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while setting child room.',
      };
    }
  }

  // 获取子房间列表 ------------------------------------------------------------------------
  static async getChildRooms(room: string): Promise<ChildRoom[]> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomSettings = await this.getRoomSettings(room);
      if (!roomSettings || !roomSettings.children) {
        return [];
      }
      return roomSettings.children;
    } catch (error) {
      console.error('Error getting child rooms:', error);
      return [];
    }
  }

  // 删除房间聊天记录 ----------------------------------------------------------------------
  static async deleteChatRecords(room: string): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const chatKey = this.getChatKey(room);
      const exists = await redisClient.exists(chatKey);
      if (exists) {
        await redisClient.del(chatKey);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting chat records:', error);
      return false;
    }
  }
  // 获取房间聊天记录 ----------------------------------------------------------------------
  // get chat messages from redis
  static async getChatMessages(room: string): Promise<ChatMsgItem[]> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized');
      }
      const chatKey = this.getChatKey(room);
      const messages = await redisClient.get(chatKey);
      if (!messages) {
        return [];
      }
      return JSON.parse(messages) as ChatMsgItem[];
    } catch (error) {
      console.error('Error getting chat messages from Redis:', error);
      return [];
    }
  }

  // 设置房间的使用情况 --------------------------------------------------------------------
  static async setRoomDateRecords(
    room: string,
    time: {
      start: number;
      end?: number;
    },
  ): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      // 获取房间的使用情况，如果没有则创建一个新的记录，如果有则需要进行判断更新
      let record = await this.getRoomDateRecords(room);
      // 通过start时间戳判断是否已经存在记录，如果有则更新结束时间戳，没有则添加新的记录
      let startRecord = record.find((r) => r.start === time.start);
      if (startRecord) {
        // 如果已经存在记录，则更新结束时间戳
        startRecord.end = time.end || Date.now();
      } else {
        // 如果不存在记录，则添加新的记录
        record.push({
          start: time.start,
          end: time.end,
        });
      }

      // 设置回存储
      const key = `${this.ROOM_DATE_RECORDS_KEY_PREFIX}${room}`;
      await redisClient.set(key, JSON.stringify(record));
      return true;
    } catch (error) {
      console.error('Error setting room date records:', error);
      return false;
    }
  }

  // 获取房间的使用情况 --------------------------------------------------------------------
  static async getRoomDateRecords(room: string): Promise<RoomTimeRecord[]> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const key = `${this.ROOM_DATE_RECORDS_KEY_PREFIX}${room}`;
      const dataStr = await redisClient.get(key);
      if (dataStr) {
        return JSON.parse(dataStr) as RoomTimeRecord[];
      }
      return [];
    } catch (error) {
      console.error('Error getting room date records:', error);
      return [];
    }
  }

  // 获取所有房间的使用情况 -----------------------------------------------------------------
  static async getAllRoomDateRecords(): Promise<RoomDateRecords> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const keys = await redisClient.keys(`${this.ROOM_DATE_RECORDS_KEY_PREFIX}*`);
      const records: RoomDateRecords = {};

      for (const key of keys) {
        const roomId = key.replace(this.ROOM_DATE_RECORDS_KEY_PREFIX, '');
        const dataStr = await redisClient.get(key);
        if (dataStr) {
          records[roomId] = JSON.parse(dataStr);
        }
      }

      return records;
    } catch (error) {
      console.error('Error getting room date records:', error);
      return {};
    }
  }

  // 判断房间是否存在 ----------------------------------------------------------------------
  static async roomExists(room: string): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomKey = this.getRoomKey(room);
      const exists = await redisClient.exists(roomKey);
      return exists > 0;
    } catch (error) {
      console.error('Error checking room existence:', error);
      return false;
    }
  }

  // 获取房间设置 --------------------------------------------------------------------------
  static async getRoomSettings(room: string): Promise<RoomSettings | null> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomKey = this.getRoomKey(room);
      const roomDataStr = await redisClient.get(roomKey);

      if (!roomDataStr) {
        return null;
      }

      return JSON.parse(roomDataStr) as RoomSettings;
    } catch (error) {
      console.error('Error getting room settings:', error);
      return null;
    }
  }

  // 设置房间设置数据 -----------------------------------------------------------------------
  static async setRoomSettings(room: string, settings: RoomSettings): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomKey = this.getRoomKey(room);
      const settingsStr = JSON.stringify(settings);
      // 设置回存储
      await redisClient.set(roomKey, settingsStr);
      // 设置到房间列表中
      await redisClient.sadd(this.ROOM_LIST_KEY_PREFIX, room);
      return true;
    } catch (error) {
      console.error('Error setting room settings:', error);
      return false;
    }
  }
  // 获取所有房间设置 -------------------------------------------------------------------
  static async getAllRooms(): Promise<RoomSettingsMap> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomKeys = await redisClient.smembers(this.ROOM_LIST_KEY_PREFIX);
      const roomMap: RoomSettingsMap = {};

      for (const roomKey of roomKeys) {
        const roomSettings = await this.getRoomSettings(roomKey);
        if (roomSettings) {
          roomMap[roomKey] = roomSettings;
        }
      }

      return roomMap;
    } catch (error) {
      console.error('Error getting all rooms:', error);
      return {};
    }
  }
  // 更新参与者设置 -----------------------------------------------------------------------
  static async updateParticipant(
    room: string,
    participantId: string,
    pData: ParticipantSettings,
  ): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      let roomSettings = await this.getRoomSettings(room);
      // 房间不存在说明是第一次创建
      if (!roomSettings) {
        let startAt = Date.now();
        roomSettings = {
          participants: {},
          ownerId: participantId,
          record: { active: false },
          startAt,
          children: [],
        };
        // 这里还需要设置到房间的使用记录中
        await this.setRoomDateRecords(room, { start: startAt });
      }

      // 更新参与者数据
      roomSettings.participants[participantId] = {
        ...roomSettings.participants[participantId],
        ...pData,
      };

      // 保存更新后的房间设置
      return await this.setRoomSettings(room, roomSettings);
    } catch (error) {
      console.error('Error updating participant:', error);
      return false;
    }
  }
  // 删除房间 -----------------------------------------------------------------------
  static async deleteRoom(room: string, start: number): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomKey = this.getRoomKey(room);
      // 删除房间设置
      await redisClient.del(roomKey);
      // 从房间列表中删除
      await redisClient.srem(this.ROOM_LIST_KEY_PREFIX, room);
      // 添加房间使用记录 end
      await this.setRoomDateRecords(room, { start, end: Date.now() });
      // 删除房间聊天记录
      await this.deleteChatRecords(room);
      return true;
    } catch (error) {
      console.error('Error deleting room:', error);
      return false;
    }
  }

  // 转让房间主持人 -----------------------------------------------------------------------
  static async transferOwnership(room: string, newOwnerId: string): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomSettings = await this.getRoomSettings(room);
      if (!roomSettings || !roomSettings.participants[newOwnerId]) {
        return false; // 房间或新主持人不存在
      } else {
        roomSettings.ownerId = newOwnerId;
        return await this.setRoomSettings(room, roomSettings);
      }
    } catch (error) {
      console.error('Error transferring ownership:', error);
      return false;
    }
  }

  // 删除参与者 -----------------------------------------------------------------------
  static async removeParticipant(
    room: string,
    participantId: string,
  ): Promise<{
    success: boolean;
    clearAll?: boolean;
    error?: string;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }

      let roomSettings = await this.getRoomSettings(room);
      if (!roomSettings || !roomSettings.participants[participantId]) {
        return {
          success: false,
          error: 'Room or participant does not exist, or not complete initialized.',
        }; // 房间或参与者不存在可能出现了问题
      }
      // 删除参与者前删除该参与者构建的子房间
      roomSettings.children
        .filter((child) => child.ownerId === participantId)
        .forEach(async (childRoom) => {
          await this.deleteChildRoom(room, childRoom.name);
        });

      // 删除参与者
      delete roomSettings.participants[participantId];
      // 先设置回去, 以防transferOwnership读取脏数据
      await this.setRoomSettings(room, roomSettings);
      // 判断这个参与者是否是主持人，如果是则进行转让，转给第一个参与者， 如果没有参与者直接删除房间
      if (Object.keys(roomSettings.participants).length === 0) {
        await this.deleteRoom(room, roomSettings.startAt);
        return {
          success: true,
          clearAll: true,
        };
      } else {
        // 进行转让, 一定有1个参与者
        if (roomSettings.ownerId === participantId) {
          const remainingParticipants = Object.keys(roomSettings.participants);
          await this.transferOwnership(
            room,
            remainingParticipants[0], // 转让给第一个剩余的参与者
          );
        }
        return {
          success: true,
          clearAll: false,
        };
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      return {
        success: false,
        clearAll: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while removing participant.',
      };
    }
  }
  // 添加房间的状态 --------------------------------------------------------------
  static async addRoomStatus(
    room: string,
    status: UserDefineStatus,
  ): Promise<{
    success: boolean;
    error?: any;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }

      let roomSettings = await this.getRoomSettings(room);
      if (!roomSettings) {
        throw new Error('Room not found');
      }
      // 房间存在，需要检查是否已经存在同名状态
      if (!roomSettings.status) {
        roomSettings.status = [status];
      } else {
        const isExist = roomSettings.status.some((s) => s.name === status.name);
        if (isExist) {
          throw new Error('Status already exists');
        } else {
          roomSettings.status.push(status);
        }
      }
      await this.setRoomSettings(room, roomSettings);
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error adding room status:', error);
      return {
        success: false,
        error,
      };
    }
  }
  // 生成新参与者 ----------------------------------------------------------------
  static async genUserName(room: string): Promise<string> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      let roomSettings = await this.getRoomSettings(room);
      if (!roomSettings) {
        let startAt = Date.now();
        roomSettings = {
          participants: {},
          ownerId: '',
          record: { active: false },
          startAt,
          children: [],
        };
        // 这里还需要设置到房间的使用记录中
        await this.setRoomDateRecords(room, { start: startAt });
      }

      // 获取所有参与者的名字
      const participants = Object.values(roomSettings.participants);
      let usedUserNames: number[] = [];
      participants.forEach((participant) => {
        if (participant.name.startsWith('User')) {
          const userName = participant.name.split(' ')[1];
          // 判断是否是数字
          if (!isNaN(parseInt(userName))) {
            // 将数字字符串转换为数字并存储
            usedUserNames.push(parseInt(userName));
          }
        }
      });

      // 直接进行排序并获取最大值，+ 1之后就是可以使用的参与者名字
      let suffix = 1; // 默认从 1 开始
      if (usedUserNames.length > 0) {
        usedUserNames.sort((a, b) => a - b);
        suffix = usedUserNames[usedUserNames.length - 1] + 1;
      }

      let suffix_str = suffix.toString();
      if (suffix < 10) {
        suffix_str = `0${suffix}`;
      }

      const availableUserName = `User ${suffix_str}`;

      return availableUserName;
    } catch (error) {
      console.error('Error generating user name:', error);
      return 'User 01'; // 默认返回第一个用户
    }
  }
  // 更新录制设置 -------------------------------------------------------
  static async updateRecordSettings(
    room: string,
    recordSettings: { egressId?: string; filePath?: string; active: boolean },
  ): Promise<{
    success: boolean;
    error?: any;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      let roomSettings = await this.getRoomSettings(room);
      if (!roomSettings) {
        throw new Error('Room not found');
      }

      // 更新录制设置
      roomSettings.record = {
        ...roomSettings.record,
        ...recordSettings,
      };
      await this.setRoomSettings(room, roomSettings);
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error updating record settings:', error);
      return {
        success: false,
        error,
      };
    }
  }
}

// 获取房间所有参与者设置
export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get('all') === 'true';
  const roomId = request.nextUrl.searchParams.get('roomId');
  const is_pre = request.nextUrl.searchParams.get('pre') === 'true';
  const is_time_record = request.nextUrl.searchParams.get('time_record') === 'true';
  const is_chat_history = request.nextUrl.searchParams.get('chat_history') === 'true';

  if (is_chat_history && roomId) {
    // 获取房间的聊天记录
    const chatMessages = await RoomManager.getChatMessages(roomId);
    return NextResponse.json(
      {
        msgs: chatMessages,
      },
      { status: 200 },
    );
  }

  // 如果是时间记录，则返回所有房间的使用情况
  if (is_time_record) {
    const allRoomDateRecords = await RoomManager.getAllRoomDateRecords();
    return NextResponse.json(
      {
        records: allRoomDateRecords,
      },
      { status: 200 },
    );
  }

  if (all) {
    const detail = request.nextUrl.searchParams.get('detail') === 'true';
    const allRooms = await RoomManager.getAllRooms();
    if (detail) {
      return NextResponse.json(allRooms, { status: 200 });
    } else {
      // 将roomSettings转为Map形式 Map<roomId, participants>
      const roomSettingsMap = Object.entries(allRooms).reduce((acc, [roomId, { participants }]) => {
        acc[roomId] = Object.keys(participants);
        return acc;
      }, {} as Record<string, string[]>);

      return NextResponse.json(roomSettingsMap);
    }
  }
  if (roomId == '' || !roomId) {
    return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
  }

  if (is_pre) {
    const availableUserName = await RoomManager.genUserName(roomId);
    return NextResponse.json({
      name: availableUserName,
    });
  } else {
    const allRooms = await RoomManager.getAllRooms();
    return NextResponse.json(
      { settings: allRooms[roomId] || { participants: {} } },
      { status: 200 },
    );
  }
}

// 更新单个参与者设置
export async function POST(request: NextRequest) {
  try {
    const childRoomReq = request.nextUrl.searchParams.get('childRoom');
    const isNameCheck = request.nextUrl.searchParams.get('nameCheck') === 'true';
    const body = await request.json();
    const {
      roomId,
      participantId,
      participantName,
      settings,
      trans,
      record,
      childRoomName,
      isPrivate,
    } = body;

    // 处理用户唯一名
    if (isNameCheck && roomId && participantName) {
      // 获取房间设置
      const roomSettings = await RoomManager.getRoomSettings(roomId);
      if (!roomSettings) {
        // 房间不存在说明是第一次创建
        return NextResponse.json({ success: true, name: participantName }, { status: 200 });
      } else {
        const pid = `${participantName}__${roomId}`;
        const participantSettings = roomSettings.participants[pid];
        console.log('participantSettings', participantSettings);
        if (participantSettings) {
          console.warn(pid);
          // 有参与者
          return NextResponse.json(
            { success: false, error: 'Participant name already exists' },
            { status: 200 },
          );
        }
      }
    }

    // 如果是创建子房间
    if (
      childRoomReq == 'true' &&
      roomId &&
      childRoomName &&
      participantId &&
      typeof isPrivate === 'boolean'
    ) {
      const childRoom = {
        name: childRoomName,
        participants: [],
        ownerId: participantId,
        isPrivate,
      } as ChildRoom;

      const { success, error } = await RoomManager.setChildRoom(roomId, childRoom);
      if (success) {
        return NextResponse.json({ success: true }, { status: 200 });
      } else {
        return NextResponse.json(
          { error: 'Child room already exists or failed to create' },
          { status: 500 },
        );
      }
    }

    // 处理录制
    if (record && roomId) {
      const { success, error } = await RoomManager.updateRecordSettings(roomId, record);

      if (success) {
        const roomSettings = await RoomManager.getRoomSettings(roomId);
        return NextResponse.json({ success: true, record: roomSettings?.record }, { status: 200 });
      } else {
        return NextResponse.json(
          { error: error || 'Failed to update record settings' },
          { status: 500 },
        );
      }
    }

    // 转让房间主持人
    if (trans && roomId && participantId) {
      const success = await RoomManager.transferOwnership(roomId, participantId);
      if (success) {
        return NextResponse.json({ success: true, ownerId: participantId }, { status: 200 });
      } else {
        return NextResponse.json({ error: 'Failed to transfer ownership' }, { status: 500 });
      }
    }

    if (!roomId || !participantId || !settings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const success = await RoomManager.updateParticipant(roomId, participantId, settings);
    return NextResponse.json({ success }, { status: 200 });
  } catch (error) {
    console.error('Error updating room settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const isUpdateChildRoom = request.nextUrl.searchParams.get('updateChildRoom') === 'true';

  const {
    roomId,
    status,
    participantId,
    childRoom,
    ty,
    isPrivate,
    newRoomName,
  }: {
    roomId?: string;
    status?: UserDefineStatus;
    childRoom?: string;
    participantId?: string;
    ty: 'name' | 'privacy';
    isPrivate?: boolean;
    newRoomName?: string;
  } = await request.json();

  if (isUpdateChildRoom && ty && roomId && childRoom) {
    if (ty === 'name' && newRoomName) {
      const { success, error } = await RoomManager.renameChildRoom(roomId, childRoom, newRoomName);
      if (success) {
        return NextResponse.json(
          { success: true, message: 'Child room renamed successfully' },
          { status: 200 },
        );
      } else {
        return NextResponse.json(
          { success: false, error: error || 'Failed to rename child room' },
          { status: 500 },
        );
      }
    } else if (ty === 'privacy' && isPrivate !== undefined) {
      const { success, error } = await RoomManager.switchChildRoomPrivacy(
        roomId,
        childRoom,
        isPrivate,
      );
      if (success) {
        return NextResponse.json(
          { success: true, message: 'Child room privacy updated successfully' },
          { status: 200 },
        );
      } else {
        return NextResponse.json(
          { success: false, error: error || 'Failed to update child room privacy' },
          { status: 500 },
        );
      }
    }
  }

  // 向子房间中添加参与者
  if (roomId && participantId && childRoom) {
    const { success, error } = await RoomManager.addParticipantToChildRoom(
      roomId,
      childRoom,
      participantId,
    );
    if (success) {
      return NextResponse.json({ success: true }, { status: 200 });
    }
    return NextResponse.json(
      { success: false, error: error || 'Failed to add participant to child room' },
      { status: 500 },
    );
  }

  if (!roomId || !status) {
    return NextResponse.json({ error: 'Room ID and status are required' }, { status: 400 });
  }

  const { success, error } = await RoomManager.addRoomStatus(roomId, status);

  if (success) {
    const roomSettings = await RoomManager.getRoomSettings(roomId);
    return NextResponse.json(
      { success: true, status: roomSettings?.status, roomId },
      { status: 200 },
    );
  } else {
    return NextResponse.json(
      {
        error,
        status,
      },
      {
        status: 500,
      },
    );
  }
}

// 清除参与者设置（当参与者离开房间时）
export async function DELETE(request: NextRequest) {
  const socketId = request.nextUrl.searchParams.get('socketId');
  const isChildRoom = request.nextUrl.searchParams.get('childRoom') === 'true';
  const isDelete = request.nextUrl.searchParams.get('delete') === 'true';
  const isLeave = request.nextUrl.searchParams.get('leave') === 'true';
  // [离开子房间] ---------------------------------------------------------------------------------------------
  if (isChildRoom && isLeave) {
    const body = await request.json();
    const { roomId, participantId, childRoom } = body;

    if (!roomId || !participantId || !childRoom) {
      return NextResponse.json(
        { error: 'Room ID, Participant ID and Child Room are required' },
        { status: 400 },
      );
    }

    // 从子房间中移除参与者
    const { success, error } = await RoomManager.removeParticipantFromChildRoom(
      roomId,
      childRoom,
      participantId,
    );
    if (success) {
      return NextResponse.json({ success: true, message: 'Participant removed from child room' });
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to remove participant from child room', error },
        { status: 500 },
      );
    }
  } else if (isChildRoom && isDelete) {
    // 删除子房间 ----------------------------------------------------------------------------------------------
    const { roomId, childRoom } = await request.json();
    const success = await RoomManager.deleteChildRoom(roomId, childRoom);
    if (success) {
      return NextResponse.json({ success: true, message: 'Child room deleted successfully' });
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to delete child room' },
        { status: 500 },
      );
    }
  } else {
    if (socketId) {
      // 如果有socketId，说明是通过socket连接的参与者离开, 因为有些使用者不会点击离开按钮，而是直接关闭浏览器或标签页
      // 所以这里要从redis中找到这个对应socketId的参与者
      const allRooms = await RoomManager.getAllRooms();
      let participantFound = false;
      for (const [roomId, settings] of Object.entries(allRooms)) {
        for (const [participantId, participant] of Object.entries(settings.participants)) {
          if (participant.socketId === socketId) {
            participantFound = true;
            // 找到对应的参与者，进行删除
            const { success, clearAll, error } = await RoomManager.removeParticipant(
              roomId,
              participantId,
            );
            if (success) {
              if (clearAll) {
                return NextResponse.json({ success: true, clearRoom: roomId });
              }
              return NextResponse.json({
                success: true,
                message: 'Participant removed successfully',
              });
            } else {
              return NextResponse.json(
                { success: false, message: 'Failed to remove participant', error },
                { status: 500 },
              );
            }
          }
        }
      }

      // 如果循环结束后没有找到参与者
      if (!participantFound) {
        return NextResponse.json(
          { success: true, message: 'Participant not found for the given socketId' },
          { status: 200 },
        );
      }
    }
    // 不是使用socketId断开来处理离开房间 --------------------------------------------------------------------
    const { roomId, participantId } = await request.json();
    if (!roomId || !participantId) {
      return NextResponse.json(
        { error: 'Room ID and Participant ID are required' },
        { status: 400 },
      );
    }

    let { success, clearAll, error } = await RoomManager.removeParticipant(roomId, participantId);
    if (success) {
      if (clearAll) {
        return NextResponse.json({ success: true, clearRoom: roomId });
      }
      return NextResponse.json({ success: true, message: 'Participant removed successfully' });
    }

    return NextResponse.json(
      { success: false, message: 'Failed to remove participant', error },
      { status: 500 },
    );
  }
}
