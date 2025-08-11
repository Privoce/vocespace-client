// /app/api/space/route.ts
import { isUndefinedString, UserDefineStatus } from '@/lib/std';
import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { ChatMsgItem } from '@/lib/std/chat';
import { ChildRoom, DEFAULT_SPACE_INFO, ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { RoomServiceClient } from 'livekit-server-sdk';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsParticipant } from '@/lib/std/device';
import {
  CheckNameBody,
  DefineUserStatusBody,
  DefineUserStatusResponse,
  DeleteSpaceParticipantBody,
  UpdateOwnerIdBody,
  UpdateSpaceAppsBody,
  UpdateSpaceParticipantBody,
} from '@/lib/api/space';
import { UpdateRecordBody } from '@/lib/api/record';
import {
  ChildRoomMethods,
  CreateRoomBody,
  DeleteRoomBody,
  JoinRoomBody,
  LeaveRoomBody,
  UpdateRoomBody,
} from '@/lib/api/channel';
import { getConfig } from '../conf/conf';

interface SpaceInfoMap {
  [spaceId: string]: SpaceInfo;
}

interface SpaceTimeRecord {
  start: number; // 记录开始时间戳
  end?: number; // 记录结束时间戳
}

// 记录空间的使用情况
interface SpaceDateRecords {
  [spaceId: string]: SpaceTimeRecord[];
}

// [redis config env] ----------------------------------------------------------
const {
  redis: { enabled, host, port, password, db },
} = getConfig();

let redisClient: Redis | null = null;

// [build redis client] --------------------------------------------------------
if (enabled) {
  redisClient = new Redis({
    host,
    port,
    password,
    db,
  });
}

class SpaceManager {
  // 空间 redis key 前缀
  private static SPACE_KEY_PREFIX = 'space:';
  // 参与者 redis key 前缀
  private static PARTICIPANT_KEY_PREFIX = 'space:participant:';
  // 空间列表 redis key 前缀 （房间不止一个）
  private static SPACE_LIST_KEY_PREFIX = 'space:list:';
  // 空间使用情况 redis key 前缀
  private static SPACE_DATE_RECORDS_KEY_PREFIX = 'space:date:records:';
  // 聊天记录 redis key 前缀
  private static CHAT_KEY_PREFIX = 'chat:';

  private static getChatKey(space: string): string {
    return `${this.CHAT_KEY_PREFIX}${space}`;
  }

  // space redis key, like: space:test_space
  private static getSpaceKey(space: string): string {
    return `${this.SPACE_KEY_PREFIX}${space}`;
  }
  // participant redis key
  private static getParticipantKey(space: string, participantId: string): string {
    return `${this.PARTICIPANT_KEY_PREFIX}${space}:${participantId}`;
  }

  // 切换房间隐私性 ----------------------------------------------------------------------
  static async switchChildRoomPrivacy(
    spaceName: string,
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

      const spaceInfo = await this.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        throw new Error(`Space ${spaceName} does not exist.`);
      }

      // 查找子房间
      const childRoomData = spaceInfo.children.find((c) => c.name === childRoom);
      if (!childRoomData) {
        throw new Error(`Child room ${childRoom} does not exist in space ${spaceName}.`);
      }

      // 修改子房间的隐私性
      childRoomData.isPrivate = isPrivate;

      // 设置回存储
      await this.setSpaceInfo(spaceName, spaceInfo);
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

      const spaceInfo = await this.getSpaceInfo(room);
      if (!spaceInfo) {
        throw new Error(`Room ${room} does not exist.`);
      }

      // 查找子房间
      const childRoomData = spaceInfo.children.find((c) => c.name === childRoom);
      if (!childRoomData) {
        throw new Error(`Child room ${childRoom} does not exist in room ${room}.`);
      }

      // 检查新名字是否已经存在
      if (spaceInfo.children.some((c) => c.name === newChildRoomName)) {
        return {
          success: false,
          error: `Child room with name ${newChildRoomName} already exists.`,
        };
      }

      // 修改子房间名字
      childRoomData.name = newChildRoomName;

      // 设置回存储
      await this.setSpaceInfo(room, spaceInfo);
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

      const spaceInfo = await this.getSpaceInfo(room);
      if (!spaceInfo) {
        throw new Error(`Room ${room} does not exist.`);
      }

      // 查找子房间
      const childRoomData = spaceInfo.children.find((c) => c.name === childRoom);
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
      await this.setSpaceInfo(room, spaceInfo);
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

      const spaceInfo = await this.getSpaceInfo(room);
      if (!spaceInfo) {
        throw new Error(`Room ${room} does not exist.`);
      }

      // 查找子房间
      const childRoomData = spaceInfo.children.find((c) => c.name === childRoom);
      if (!childRoomData) {
        throw new Error(`Child room ${childRoom} does not exist in room ${room}.`);
      }

      // 检查参与者是否已经在某个子房间中
      for (const child of spaceInfo.children) {
        if (child.participants.includes(participantId)) {
          // 如果已经在其他的房间，就需要退出
          child.participants = child.participants.filter((p) => p !== participantId);
          break;
        }
      }

      // 检查参与者是否已经在要加入的子房间中
      if (childRoomData.participants.includes(participantId)) {
        return {
          success: false,
          error: `Participant ${participantId} is already in child room ${childRoom}.`,
        }; // 参与者已经在子房间中
      }

      // 添加参与者到子房间
      childRoomData.participants.push(participantId);

      // 设置回存储
      await this.setSpaceInfo(room, spaceInfo);
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
      const spaceInfo = await this.getSpaceInfo(room);
      if (!spaceInfo) {
        throw new Error(`Room ${room} does not exist.`);
      }
      // 查找子房间
      const childRoomIndex = spaceInfo.children.findIndex((c) => c.name === childRoomName);
      if (childRoomIndex === -1) {
        throw new Error(`Child room ${childRoomName} does not exist in room ${room}.`);
      }
      // 删除子房间
      spaceInfo.children.splice(childRoomIndex, 1);
      // 设置回存储
      return await this.setSpaceInfo(room, spaceInfo);
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
      const spaceInfo = await this.getSpaceInfo(room);
      if (!spaceInfo) {
        throw new Error(`Room ${room} does not exist.`);
      }
      // 如果子房间已经存在，则不添加
      if (spaceInfo.children.some((c) => c.name === childRoom.name)) {
        return {
          success: true,
        };
      }
      spaceInfo.children.push(childRoom);
      await this.setSpaceInfo(room, spaceInfo);
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
      const spaceInfo = await this.getSpaceInfo(room);
      if (!spaceInfo || !spaceInfo.children) {
        return [];
      }
      return spaceInfo.children;
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

  // 设置空间的使用情况 --------------------------------------------------------------------
  static async setSpaceDateRecords(
    space: string,
    time: {
      start: number;
      end?: number;
    },
  ): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      // 获取空间的使用情况，如果没有则创建一个新的记录，如果有则需要进行判断更新
      let record = await this.getSpaceDateRecords(space);
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
      const key = `${this.SPACE_DATE_RECORDS_KEY_PREFIX}${space}`;
      await redisClient.set(key, JSON.stringify(record));
      return true;
    } catch (error) {
      console.error('Error setting room date records:', error);
      return false;
    }
  }

  // 获取空间的使用情况 --------------------------------------------------------------------
  static async getSpaceDateRecords(space: string): Promise<SpaceTimeRecord[]> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const key = `${this.SPACE_DATE_RECORDS_KEY_PREFIX}${space}`;
      const dataStr = await redisClient.get(key);
      if (dataStr) {
        return JSON.parse(dataStr) as SpaceTimeRecord[];
      }
      return [];
    } catch (error) {
      console.error('Error getting room date records:', error);
      return [];
    }
  }

  // 获取所有空间的使用情况 -----------------------------------------------------------------
  static async getAllSpaceDateRecords(): Promise<SpaceDateRecords> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const keys = await redisClient.keys(`${this.SPACE_DATE_RECORDS_KEY_PREFIX}*`);
      const records: SpaceDateRecords = {};

      for (const key of keys) {
        const spaceId = key.replace(this.SPACE_DATE_RECORDS_KEY_PREFIX, '');
        const dataStr = await redisClient.get(key);
        if (dataStr) {
          records[spaceId] = JSON.parse(dataStr);
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
      const spaceKey = this.getSpaceKey(room);
      const exists = await redisClient.exists(spaceKey);
      return exists > 0;
    } catch (error) {
      console.error('Error checking room existence:', error);
      return false;
    }
  }

  // 获取房间设置 --------------------------------------------------------------------------
  static async getSpaceInfo(space: string): Promise<SpaceInfo | null> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const spaceKey = this.getSpaceKey(space);
      const spaceDataStr = await redisClient.get(spaceKey);

      if (!spaceDataStr) {
        return null;
      }

      return JSON.parse(spaceDataStr) as SpaceInfo;
    } catch (error) {
      console.error('Error getting space settings:', error);
      return null;
    }
  }

  // 设置房间设置数据 -----------------------------------------------------------------------
  static async setSpaceInfo(spaceName: string, settings: SpaceInfo): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const spaceKey = this.getSpaceKey(spaceName);
      const settingsStr = JSON.stringify(settings);
      // 设置回存储
      await redisClient.set(spaceKey, settingsStr);
      // 设置到房间列表中
      await redisClient.sadd(this.SPACE_LIST_KEY_PREFIX, spaceName);
      return true;
    } catch (error) {
      console.error('Error setting room settings:', error);
      return false;
    }
  }
  // 获取所有房间设置 -------------------------------------------------------------------
  static async getAllSpaces(): Promise<SpaceInfoMap> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const roomKeys = await redisClient.smembers(this.SPACE_LIST_KEY_PREFIX);
      const roomMap: SpaceInfoMap = {};

      for (const roomKey of roomKeys) {
        const spaceInfo = await this.getSpaceInfo(roomKey);
        if (spaceInfo) {
          roomMap[roomKey] = spaceInfo;
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
      let spaceInfo = await this.getSpaceInfo(room);
      // 房间不存在说明是第一次创建
      if (!spaceInfo) {
        let startAt = Date.now();
        spaceInfo = {
          ...DEFAULT_SPACE_INFO(startAt),
          ownerId: participantId,
        };
        // 这里还需要设置到房间的使用记录中
        await this.setSpaceDateRecords(room, { start: startAt });
      }

      // 更新参与者数据
      spaceInfo.participants[participantId] = {
        ...spaceInfo.participants[participantId],
        ...pData,
      };

      // 保存更新后的房间设置
      return await this.setSpaceInfo(room, spaceInfo);
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
      const roomKey = this.getSpaceKey(room);
      const chatKey = this.getChatKey(room);
      const pipeline = redisClient.pipeline();
      // 删除房间设置
      pipeline.del(roomKey);
      // 从空间列表中删除
      pipeline.srem(this.SPACE_LIST_KEY_PREFIX, room);
      pipeline.del(chatKey);
      const results = await pipeline.exec();
      const success = results?.every((result) => result[0] === null);

      if (success) {
        // 添加房间使用记录 end
        await this.setSpaceDateRecords(room, { start, end: Date.now() });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting room:', error);
      return false;
    }
  }

  // 转让房间主持人 -----------------------------------------------------------------------
  static async transferOwner(spaceName: string, newOwnerId: string): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const spaceInfo = await this.getSpaceInfo(spaceName);
      if (!spaceInfo || !spaceInfo.participants[newOwnerId]) {
        return false; // 房间或新主持人不存在
      } else {
        spaceInfo.ownerId = newOwnerId;
        return await this.setSpaceInfo(spaceName, spaceInfo);
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

      let spaceInfo = await this.getSpaceInfo(room);
      if (!spaceInfo || !spaceInfo.participants[participantId]) {
        return {
          success: false,
          error: 'Room or participant does not exist, or not complete initialized.',
        }; // 房间或参与者不存在可能出现了问题
      }
      // 删除参与者前删除该参与者构建的子房间 (新需求无需清理子房间, 暂时注释)
      // const childRoomsToDelete = spaceInfo.children
      //   .filter((child) => child.ownerId === participantId)
      //   .map((child) => child.name);

      // if (childRoomsToDelete.length > 0) {
      //   await Promise.all(
      //     childRoomsToDelete.map(async (roomName) => {
      //       await this.deleteChildRoom(room, roomName);
      //     }),
      //   );

      //   // 重新获取最新的房间设置
      //   spaceInfo = await this.getSpaceInfo(room);
      //   if (!spaceInfo) {
      //     return {
      //       success: false,
      //       error: 'Room settings changed during deletion process.',
      //     };
      //   }
      // }
      // 检查当前这个参与者是否在子房间中，如果在子房间需要移除
      const childRooms = spaceInfo.children.filter((child) =>
        child.participants.includes(participantId),
      );
      if (childRooms.length > 0) {
        await Promise.all(
          // 遍历所有子房间进行删除，虽然某个人只可能在一个子房间中，单可能出现bug导致一个人同时在多个子房间中
          // 这里正常去除即可，等到后面删除了参与者一起设置回去
          childRooms.map(async (child) => {
            child.participants = child.participants.filter((id) => id !== participantId);
          }),
        );
      }

      // 删除参与者
      delete spaceInfo.participants[participantId];
      // 先设置回去, 以防transferOwner读取脏数据
      await this.setSpaceInfo(room, spaceInfo);
      // 判断这个参与者是否是主持人，如果是则进行转让，转给第一个参与者， 如果没有参与者直接删除房间
      if (Object.keys(spaceInfo.participants).length === 0) {
        await this.deleteRoom(room, spaceInfo.startAt);
        return {
          success: true,
          clearAll: true,
        };
      } else {
        // 进行转让, 一定有1个参与者
        if (spaceInfo.ownerId === participantId) {
          const remainingParticipants = Object.keys(spaceInfo.participants);
          await this.transferOwner(
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
  // 定义(添加)房间的状态 --------------------------------------------------------------
  static async defineStatus(
    spaceName: string,
    status: UserDefineStatus,
  ): Promise<{
    success: boolean;
    error?: any;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }

      let spaceInfo = await this.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        throw new Error('Room not found');
      }
      // 房间存在，需要检查是否已经存在同名状态
      if (!spaceInfo.status) {
        spaceInfo.status = [status];
      } else {
        const isExist = spaceInfo.status.some((s) => s.name === status.name);
        if (isExist) {
          throw new Error('Status already exists');
        } else {
          spaceInfo.status.push(status);
        }
      }
      await this.setSpaceInfo(spaceName, spaceInfo);
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
      let spaceInfo = await this.getSpaceInfo(room);
      if (!spaceInfo) {
        let startAt = Date.now();
        // spaceInfo = {
        //   participants: {},
        //   ownerId: '',
        //   record: { active: false },
        //   startAt,
        //   children: [],
        // };
        spaceInfo = DEFAULT_SPACE_INFO(startAt);
        // 这里还需要设置到房间的使用记录中
        await this.setSpaceDateRecords(room, { start: startAt });
      }

      // 获取所有参与者的名字
      const participants = Object.values(spaceInfo.participants);
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
    space: string,
    recordSettings: { egressId?: string; filePath?: string; active: boolean },
  ): Promise<{
    success: boolean;
    error?: any;
  }> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      let spaceInfo = await this.getSpaceInfo(space);
      if (!spaceInfo) {
        throw new Error('Room not found');
      }

      // 更新录制设置
      spaceInfo.record = {
        ...spaceInfo.record,
        ...recordSettings,
      };
      await this.setSpaceInfo(space, spaceInfo);
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
  const isAll = request.nextUrl.searchParams.get('all') === 'true';
  const spaceName = request.nextUrl.searchParams.get('spaceName');
  const isPre = request.nextUrl.searchParams.get('pre') === 'true';
  const isTimeRecord = request.nextUrl.searchParams.get('timeRecord') === 'true';
  const isChat = request.nextUrl.searchParams.get('chat') === 'true';
  const isHistory = request.nextUrl.searchParams.get('history') === 'true';
  // 获取某个空间的聊天记录 --------------------------------------------------------------------------
  if (isChat && isHistory && spaceName) {
    const chatMessages = await SpaceManager.getChatMessages(spaceName);
    return NextResponse.json(
      {
        msgs: chatMessages,
      },
      { status: 200 },
    );
  }

  // 如果是时间记录，则返回所有空间的使用情况 ------------------------------------------------------------
  if (isTimeRecord) {
    const allSpaceDateRecords = await SpaceManager.getAllSpaceDateRecords();
    return NextResponse.json(
      {
        records: allSpaceDateRecords,
      },
      { status: 200 },
    );
  }
  // 获取所有空间的设置 ------------------------------------------------------------------------------
  if (isAll) {
    // 是否需要获取详细信息
    const isDetail = request.nextUrl.searchParams.get('detail') === 'true';
    const allSpaces = await SpaceManager.getAllSpaces();
    if (isDetail) {
      return NextResponse.json(allSpaces, { status: 200 });
    } else {
      // 将roomSettings转为Map形式 Map<spaceName, participants>
      const roomSettingsMap = Object.entries(allSpaces).reduce(
        (acc, [spaceName, { participants }]) => {
          acc[spaceName] = Object.keys(participants);
          return acc;
        },
        {} as Record<string, string[]>,
      );

      return NextResponse.json(roomSettingsMap);
    }
  }
  // 生成一个可用的用户名字 -----------------------------------------------------------------------------
  if (isPre && spaceName) {
    const availableUserName = await SpaceManager.genUserName(spaceName);
    return NextResponse.json({
      name: availableUserName,
    });
  }
  // 获取某个房间的数据 ---------------------------------------------------------------------------------
  if (spaceName) {
    const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
    return NextResponse.json({ settings: spaceInfo || { participants: {} } }, { status: 200 });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

// 更新单个参与者设置
export async function POST(request: NextRequest) {
  try {
    const isChildRoom = request.nextUrl.searchParams.get('childRoom') === 'true';
    const isNameCheck = request.nextUrl.searchParams.get('nameCheck') === 'true';
    const isUpdateRecord = request.nextUrl.searchParams.get('record') === 'update';
    const isUpdateOwnerId = request.nextUrl.searchParams.get('ownerId') === 'update';
    const isUpdateParticipant = request.nextUrl.searchParams.get('participant') === 'update';
    const isSpace = request.nextUrl.searchParams.get('space') === 'true';
    const isUpdateSpaceApps = request.nextUrl.searchParams.get('apps') === 'update';
    // 更新Space的Apps ----------------------------------------------------------------------
    if (isUpdateSpaceApps) {
      const { spaceName, appKey, enabled }: UpdateSpaceAppsBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      if (enabled && !spaceInfo.apps.includes(appKey)) {
        // 如果不存在则添加
        spaceInfo.apps.push(appKey);
      } else if (!enabled && spaceInfo.apps.includes(appKey)) {
        // 如果存在则移除
        spaceInfo.apps = spaceInfo.apps.filter((app) => app !== appKey);
      }
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update space apps' }, { status: 500 });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 处理用户唯一名 -------------------------------------------------------------------------
    if (isNameCheck) {
      const { spaceName, participantName }: CheckNameBody = await request.json();
      // 获取房间设置
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        // 房间不存在说明是第一次创建
        return NextResponse.json({ success: true, name: participantName }, { status: 200 });
      } else {
        const pid = `${participantName}__${spaceName}`;
        const participantSettings = spaceInfo.participants[pid];
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

    // 如果是创建子房间 -------------------------------------------------------------------------
    if (isChildRoom) {
      const { spaceName, roomName, participantId, isPrivate }: CreateRoomBody =
        await request.json();

      const childRoom = {
        name: roomName,
        participants: [],
        ownerId: participantId,
        isPrivate,
      } as ChildRoom;

      const { success, error } = await SpaceManager.setChildRoom(spaceName, childRoom);
      if (success) {
        return NextResponse.json({ success: true }, { status: 200 });
      } else {
        return NextResponse.json({ error }, { status: 500 });
      }
    }

    // 处理录制 --------------------------------------------------------------------------------
    if (isUpdateRecord) {
      const { spaceName, record }: UpdateRecordBody = await request.json();
      const { success, error } = await SpaceManager.updateRecordSettings(spaceName, record);

      if (success) {
        const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
        return NextResponse.json({ success: true, record: spaceInfo?.record }, { status: 200 });
      } else {
        return NextResponse.json(
          { error: error || 'Failed to update record settings' },
          { status: 500 },
        );
      }
    }

    // 转让房间主持人 ---------------------------------------------------------------------------
    if (isUpdateOwnerId) {
      const { spaceName, participantId }: UpdateOwnerIdBody = await request.json();
      const success = await SpaceManager.transferOwner(spaceName, participantId);
      if (success) {
        return NextResponse.json({ success: true, ownerId: participantId }, { status: 200 });
      } else {
        return NextResponse.json({ error: 'Failed to transfer ownership' }, { status: 500 });
      }
    }
    // 更新参与者设置 ---------------------------------------------------------------------------
    if (isUpdateParticipant && isSpace) {
      const { spaceName, settings, participantId }: UpdateSpaceParticipantBody =
        await request.json();
      const success = await SpaceManager.updateParticipant(spaceName, participantId, settings);
      return NextResponse.json({ success }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error updating room settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const childRoom = request.nextUrl.searchParams.get('childRoom') as ChildRoomMethods | null;
  const isDefineStatus = request.nextUrl.searchParams.get('status') === 'true';
  // 更新子房间的名字或隐私设置 -------------------------------------------------------------------
  if (childRoom === ChildRoomMethods.UPDATE) {
    const { ty, spaceName, roomName, isPrivate, newRoomName }: UpdateRoomBody =
      await request.json();
    if (ty === 'name' && newRoomName) {
      const { success, error } = await SpaceManager.renameChildRoom(
        spaceName,
        roomName,
        newRoomName,
      );
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
      const { success, error } = await SpaceManager.switchChildRoomPrivacy(
        spaceName,
        roomName,
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

  // 向子房间中添加参与者 -------------------------------------------------------------------
  if (childRoom === ChildRoomMethods.JOIN) {
    const { spaceName, roomName, participantId }: JoinRoomBody = await request.json();
    const { success, error } = await SpaceManager.addParticipantToChildRoom(
      spaceName,
      roomName,
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
  // 用户自定义状态 -------------------------------------------------------------------------------------
  if (isDefineStatus) {
    const { spaceName, status }: DefineUserStatusBody = await request.json();
    if (!spaceName || !status) {
      return NextResponse.json({ error: 'Space name and status are required' }, { status: 400 });
    }
    const { success, error } = await SpaceManager.defineStatus(spaceName, status);
    if (success) {
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      return NextResponse.json(
        { success: true, status: spaceInfo?.status, spaceName } as DefineUserStatusResponse,
        { status: 200 },
      );
    } else {
      return NextResponse.json(
        {
          error,
          status: [status],
        } as DefineUserStatusResponse,
        {
          status: 500,
        },
      );
    }
  }
}

// 清除参与者设置（当参与者离开房间时）
export async function DELETE(request: NextRequest) {
  const socketId = request.nextUrl.searchParams.get('socketId');
  const childRoom = request.nextUrl.searchParams.get('childRoom') as ChildRoomMethods | null;
  const isDeleteParticipant = request.nextUrl.searchParams.get('participant') === 'delete';
  const isSpace = request.nextUrl.searchParams.get('space') === 'true';
  // [离开子房间] ---------------------------------------------------------------------------------------------
  if (childRoom === ChildRoomMethods.LEAVE) {
    const body = await request.json();
    const { spaceName, participantId, roomName }: LeaveRoomBody = body;
    // 从子房间中移除参与者
    const { success, error } = await SpaceManager.removeParticipantFromChildRoom(
      spaceName,
      roomName,
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
  } else if (childRoom === ChildRoomMethods.DELETE) {
    // 删除子房间 ----------------------------------------------------------------------------------------------
    const { spaceName, roomName }: DeleteRoomBody = await request.json();
    const success = await SpaceManager.deleteChildRoom(spaceName, roomName);
    if (success) {
      return NextResponse.json({ success: true, message: 'Child room deleted successfully' });
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to delete child room' },
        { status: 500 },
      );
    }
  }

  if (socketId) {
    // 如果有socketId，说明是通过socket连接的参与者离开, 因为有些使用者不会点击离开按钮，而是直接关闭浏览器或标签页
    // 所以这里要从redis中找到这个对应socketId的参与者
    const allRooms = await SpaceManager.getAllSpaces();
    let participantFound = false;
    for (const [spaceId, settings] of Object.entries(allRooms)) {
      for (const [participantId, participant] of Object.entries(settings.participants)) {
        if (participant.socketId === socketId) {
          participantFound = true;
          // 找到对应的参与者，进行删除
          const { success, clearAll, error } = await SpaceManager.removeParticipant(
            spaceId,
            participantId,
          );
          if (success) {
            if (clearAll) {
              return NextResponse.json({ success: true, clearRoom: spaceId });
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
  if (isSpace && isDeleteParticipant) {
    const { spaceName, participantId }: DeleteSpaceParticipantBody = await request.json();
    let { success, clearAll, error } = await SpaceManager.removeParticipant(
      spaceName,
      participantId,
    );
    if (success) {
      if (clearAll) {
        return NextResponse.json({ success: true, clearSpace: spaceName });
      }
      return NextResponse.json({ success: true, message: 'Participant removed successfully' });
    }

    return NextResponse.json(
      { success: false, message: 'Failed to remove participant', error },
      { status: 500 },
    );
  }
}

const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

// 用户心跳检测
// 经过测试，发现当用户退出房间时可能会失败，导致用户实际已经退出，但服务端数据还存在
// 增加心跳检测，定时检查用户是否在线，若用户已经离线，需要从房间中进行移除, 依赖livekit server api
const userHeartbeat = async () => {
  if (
    isUndefinedString(LIVEKIT_API_KEY) ||
    isUndefinedString(LIVEKIT_API_SECRET) ||
    isUndefinedString(LIVEKIT_URL)
  ) {
    console.warn('LiveKit API credentials are not set, skipping user heartbeat check.');
    return;
  }

  const roomServer = new RoomServiceClient(LIVEKIT_URL!, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!);
  // 列出所有房间
  const currentRooms = await roomServer.listRooms();
  for (const room of currentRooms) {
    // 列出房间中所有的参与者，然后和redis中的参与者进行对比
    const roomParticipants = await roomServer.listParticipants(room.name);
    const redisRoom = await SpaceManager.getSpaceInfo(room.name);
    if (!redisRoom) {
      continue; // 如果redis中没有这个房间，跳过 (本地开发环境和正式环境使用的redis不同，但服务器是相同的)
    }
    const redisParticipants = Object.keys(redisRoom.participants);
    // 有两种情况: 1. redis中有参与者但livekit中没有, 2. livekit中有参与者但redis中没有
    // 情况1: 说明参与者已经离开了房间，但redis中没有清除，需要从redis中删除
    // 情况2: 说明参与者实际是在房间中的，但是redis中没有初始化成功，这时候就需要告知参与者进行初始化 (socket.io)

    // 首先获取两种情况的参与者
    const inRedisNotInLK = redisParticipants.filter((p) => {
      return !roomParticipants.some((lkParticipant) => lkParticipant.identity === p);
    });

    const inLKNotInRedis = roomParticipants.filter((lkParticipant) => {
      return !redisParticipants.includes(lkParticipant.identity);
    });
    // 处理情况1 --------------------------------------------------------------------------------------------
    if (inRedisNotInLK.length > 0) {
      for (const participantId of inRedisNotInLK) {
        await SpaceManager.removeParticipant(room.name, participantId);
      }
    }

    // 处理情况2 --------------------------------------------------------------------------------------------
    if (inLKNotInRedis.length > 0) {
      for (const participant of inLKNotInRedis) {
        socket.emit('re_init', {
          room: room.name,
          participantId: participant.identity,
        } as WsParticipant);
      }
    }
  }
};

// 定时任务，每隔5分钟执行一次
setInterval(async () => {
  await userHeartbeat();
}, 5 * 60 * 1000); // 每5分钟执行一次
