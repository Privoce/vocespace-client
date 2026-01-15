// /app/api/space/route.ts
import {
  DEFAULT_USER_DEFINE_STATUS,
  ERROR_CODE,
  isUndefinedString,
  UserDefineStatus,
  UserStatus,
} from '@/lib/std';
import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { ChatMsgItem } from '@/lib/std/chat';
import {
  ChildRoom,
  DEFAULT_SPACE_INFO,
  ParticipantSettings,
  SpaceInfo,
  SpaceInfoMap,
  SpaceDateRecords,
  SpaceTimeRecord,
  SpaceDateRecord,
  SpaceTimer,
  SpaceCountdown,
  SpaceTodo,
  DEFAULT_PARTICIPANT_WORK_CONF,
} from '@/lib/std/space';
import { RoomServiceClient } from 'livekit-server-sdk';
import { socket } from '@/app/rooms/[spaceName]/PageClientImpl';
import { WsParticipant } from '@/lib/std/device';
import {
  AllowGuestBody,
  CheckNameBody,
  DefineUserStatusBody,
  DefineUserStatusResponse,
  DeleteSpaceParticipantBody,
  PersistentSpaceBody,
  TransOrSetOMBody,
  UpdateOwnerIdBody,
  UpdateSpaceAppAuthBody,
  UpdateSpaceAppsBody,
  UpdateSpaceAppSyncBody,
  UpdateSpaceParticipantBody,
  UploadSpaceAppBody,
  WorkModeBody,
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
import { platformAPI } from '@/lib/api/platform';

const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

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
    timeRecord: SpaceTimeRecord,
    participants?: {
      [name: string]: SpaceTimeRecord[];
    },
  ): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }

      // 获取空间的使用情况，如果没有则创建一个新的记录
      let record = await this.getSpaceDateRecord(space);
      if (!record) {
        // 没有记录，表示房间第一次创建，需要创建一个新的纪录
        record = {
          space: [
            {
              start: timeRecord.start,
              end: timeRecord.end,
            },
          ],
          participants: participants || {},
        } as SpaceDateRecord;
      } else {
        // 处理房间级别的时间记录
        if (!participants) {
          // 房间级别操作（创建/删除房间）
          await this.updateSpaceTimeRecord(record, timeRecord);
        } else {
          // 用户级别操作（加入/离开房间）
          await this.updateParticipantTimeRecord(record, participants);
        }
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
  // 更新房间级别的时间记录 ----------------------------------------------------------------
  private static updateSpaceTimeRecord(record: SpaceDateRecord, timeRecord: SpaceTimeRecord): void {
    const existingRecord = record.space.find((r) => r.start === timeRecord.start);

    if (existingRecord) {
      // 如果已经存在记录，表示房间结束，更新结束时间戳
      existingRecord.end = timeRecord.end || Date.now();

      // 同时更新所有没有结束时间戳的用户记录
      Object.keys(record.participants).forEach((participantName) => {
        const userRecords = record.participants[participantName];
        if (userRecords) {
          userRecords.forEach((userRecord) => {
            if (!userRecord.end) {
              userRecord.end = timeRecord.end || Date.now();
            }
          });
        }
      });
    } else {
      // 如果不存在记录，表示房间开始，添加新的记录
      record.space.push({
        start: timeRecord.start,
        end: timeRecord.end,
      });
    }
  }

  // 更新用户级别的时间记录 ----------------------------------------------------------------
  private static updateParticipantTimeRecord(
    record: SpaceDateRecord,
    participants: { [name: string]: SpaceTimeRecord[] },
  ): void {
    Object.entries(participants).forEach(([participantName, timeRecords]) => {
      if (!record.participants[participantName]) {
        // 用户首次加入，直接设置记录
        record.participants[participantName] = timeRecords;
      } else {
        // 用户已存在，需要更新记录
        const existingRecords = record.participants[participantName];
        const newTimeRecord = timeRecords[0]; // 新传入的时间记录

        if (newTimeRecord.end) {
          // 如果新记录有结束时间，表示用户离开
          const unfinishedRecord = existingRecords.find((r) => !r.end);
          if (unfinishedRecord) {
            unfinishedRecord.end = newTimeRecord.end;
          }
        } else if (newTimeRecord.start) {
          // 如果新记录只有开始时间，表示用户加入
          // 检查是否有未结束的记录，如果没有才添加新记录
          const hasUnfinishedRecord = existingRecords.some((r) => !r.end);
          if (!hasUnfinishedRecord) {
            existingRecords.push({
              start: newTimeRecord.start,
              end: newTimeRecord.end,
            });
          }
        }
      }
    });
  }

  // 获取空间的使用情况 --------------------------------------------------------------------
  static async getSpaceDateRecord(space: string): Promise<SpaceDateRecord | null> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const key = `${this.SPACE_DATE_RECORDS_KEY_PREFIX}${space}`;
      const dataStr = await redisClient.get(key);
      if (dataStr) {
        return JSON.parse(dataStr) as SpaceDateRecord;
      }
      return null;
    } catch (error) {
      console.error('Error getting room date records:', error);
      return null;
    }
  }

  // 获取所有空间的使用情况 -----------------------------------------------------------------
  static async getAllSpaceDateRecords(): Promise<SpaceDateRecords | null> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      const keys = await redisClient.keys(`${this.SPACE_DATE_RECORDS_KEY_PREFIX}*`);
      const records: SpaceDateRecords = {};

      if (keys.length > 0) {
        for (const key of keys) {
          const spaceId = key.replace(this.SPACE_DATE_RECORDS_KEY_PREFIX, '');
          const dataStr = await redisClient.get(key);
          if (dataStr) {
            records[spaceId] = JSON.parse(dataStr);
          }
        }

        return records;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting room date records:', error);
      return null;
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
    init = false,
  ): Promise<boolean> {
    try {
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      let spaceInfo = await this.getSpaceInfo(room);
      // 房间不存在说明是第一次创建
      let startAt = Date.now();
      if (!spaceInfo) {
        spaceInfo = {
          ...DEFAULT_SPACE_INFO(startAt),
          ownerId: participantId,
        };
        // 这里还需要设置到房间的使用记录中
        await this.setSpaceDateRecords(
          room,
          { start: startAt },
          {
            [pData.name]: [{ start: startAt }],
          },
        );
      } else {
        // 房间存在，这个用户可能是新加入的，我们可以查找房间中是否有这个用户，如果没有则需要将用户记录添加到使用记录中
        let participant = spaceInfo.participants[participantId];
        if (!participant) {
          await this.setSpaceDateRecords(
            room,
            { start: spaceInfo.startAt },
            {
              [pData.name]: [{ start: startAt }],
            },
          );
        } else {
          if (init) {
            // 这里说明房间存在而且且用户也存在，说明用户可能是重连或房间是持久化的，我们无需大范围数据更新，只需要更新
            // 用户的最基础设置即可
            // 由于todo数据连接了平台端数据，所以这里需要更改为平台端的todo数据，但只有在isAuth为true时才更新
            let appDatas = participant.appDatas;
            if (pData.isAuth) {
              appDatas = {
                ...appDatas,
                todo: pData.appDatas.todo,
              };
            }

            spaceInfo.participants[participantId] = {
              ...participant,
              name: pData.name,
              volume: pData.volume,
              version: pData.version,
              blur: pData.blur,
              screenBlur: pData.screenBlur,
              socketId: pData.socketId,
              startAt: participant.startAt,
              online: true,
              appDatas,
              isAuth: pData.isAuth,
            };
            return await this.setSpaceInfo(room, spaceInfo);
          }
        }
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
  static async deleteSpace(room: string, start: number): Promise<boolean> {
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
      let participantName = spaceInfo.participants[participantId].name;
      let participantStartAt = spaceInfo.participants[participantId].startAt;
      // 删除参与者
      if (!spaceInfo.persistence) {
        delete spaceInfo.participants[participantId];
      } else {
        // 将这个用户的在线状态设置为false
        spaceInfo.participants[participantId].online = false;
      }
      // 先设置回去, 以防transferOwner读取脏数据
      await this.setSpaceInfo(room, spaceInfo);
      // 用户离开需要更新用户的end记录
      await this.setSpaceDateRecords(
        room,
        { start: spaceInfo.startAt },
        {
          [participantName]: [{ start: participantStartAt, end: Date.now() }],
        },
      );
      // 如果是持久化房间，删除参与者操作到此为止
      if (spaceInfo.persistence) {
        return {
          success: true,
          clearAll: false,
        };
      }

      // 判断这个参与者是否是主持人，如果是则进行转让，转给第一个参与者， 如果没有参与者直接删除房间
      if (Object.keys(spaceInfo.participants).length === 0) {
        if (!spaceInfo.persistence) {
          await this.deleteSpace(room, spaceInfo.startAt);
        }
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
  // 定义(添加)用户的状态 --------------------------------------------------------------
  static async defineStatus(
    spaceName: string,
    participantId: string,
    status: string,
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
      // 房间存在，获取用户进行状态更新
      let participant = spaceInfo.participants[participantId];
      if (!participant) {
        throw new Error('Participant not found');
      } else {
        spaceInfo.participants[participantId].status = status;
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
      let startAt = Date.now();
      if (!spaceInfo) {
        spaceInfo = DEFAULT_SPACE_INFO(startAt);
      }

      // 获取所有参与者的名字
      const participants = Object.values(spaceInfo.participants);

      if (participants.length === 0) {
        // 没有参与者，直接返回第一个用户（管理员）
        return 'Admin';
      }

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
      return 'Admin'; // 默认返回第一个用户(管理员)
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
  const isCreateSpace = request.nextUrl.searchParams.get('space') === 'create';
  // 创建一个新的空间 -------------------------------------------------------------------------------
  if (isCreateSpace) {
    const spaceOwner = request.nextUrl.searchParams.get('owner');
    const ownerId = request.nextUrl.searchParams.get('ownerId');
    if (!spaceOwner) {
      return NextResponse.json({ error: ERROR_CODE.createSpace.ParamLack }, { status: 200 });
    } else {
      // 如果有spaceName这个参数则使用这个作为空间名字，否则使用owner作为空间名字
      let realSpaceName = spaceName || spaceOwner;
      const spaceInfo = await SpaceManager.getSpaceInfo(realSpaceName);
      if (spaceInfo) {
        return NextResponse.json({ error: ERROR_CODE.createSpace.SpaceExist }, { status: 200 });
      }
      const newSpaceInfo = {
        ...DEFAULT_SPACE_INFO(Date.now()),
        ownerId: ownerId || `${spaceOwner}__${spaceOwner}`,
      } as SpaceInfo;

      await SpaceManager.setSpaceInfo(realSpaceName, newSpaceInfo);
      return NextResponse.json({ success: true }, { status: 200 });
    }
  }
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
    const spaceAppsAPIType = request.nextUrl.searchParams.get('apps');
    const isUpdateSpacePersistence = request.nextUrl.searchParams.get('persistence') === 'update';
    const isUpdate = request.nextUrl.searchParams.get('update') === 'true';
    const isUpdateAllowGuest = request.nextUrl.searchParams.get('allowGuest') === 'update';
    const isTransfer = request.nextUrl.searchParams.get('transfer') === 'true';
    const isAuthManage = request.nextUrl.searchParams.get('auth') === 'manage';
    const mode = request.nextUrl.searchParams.get('mode');
    // 开启/关闭 工作模式 -------------------------------------------------------------------------
    if (mode === 'work') {
      const { spaceName, participantId, workType }: WorkModeBody = await request.json();
      // 获取空间信息和用户信息
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      const participant = spaceInfo.participants[participantId];
      if (!participant) {
        return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
      }
      // 先检测当前用户的work和传入的workType是否一致，如果一致则直接返回成功，因为已经是这个状态了
      if (workType === participant.work.enabled) {
        return NextResponse.json({ success: true, workType }, { status: 200 });
      }

      // 如果是关闭工作模式
      // 通过用户的work结构中的配置还原用户的视频模糊度和屏幕模糊度，并设置enabled字段为false
      if (!workType) {
        participant.blur = participant.work.videoBlur;
        participant.screenBlur = participant.work.screenBlur;
        // 将work结构设置为DEFAULT
        participant.work = DEFAULT_PARTICIPANT_WORK_CONF;
        await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
        return NextResponse.json({ success: true, workType }, { status: 200 });
      } else {
        // 如果是开启工作模式
        // 将当前用户的work结构中的enabled字段设置为true，并根据配置设置用户的视频模糊度和屏幕模糊度
        participant.work.enabled = true;
        participant.work.videoBlur = participant.blur;
        participant.work.screenBlur = participant.screenBlur;
        // 设置用户的视频模糊度和屏幕模糊度为工作模式下的配置
        if (spaceInfo.work.sync) {
          participant.blur = spaceInfo.work.videoBlur;
          participant.screenBlur = spaceInfo.work.screenBlur;
        }
        await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
        return NextResponse.json({ success: true, workType }, { status: 200 });
      }
    }
    // 用户身份处理 -----------------------------------------------------------------------------
    if (isSpace && isAuthManage) {
      let isRemove = false;
      const { spaceName, participantId, replacedId }: TransOrSetOMBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      // 先确定participantId的是否在当前的space中
      if (spaceInfo.participants[participantId] === undefined) {
        return NextResponse.json({ error: 'Participant not in space' }, { status: 403 });
      }

      if (spaceInfo.participants[replacedId] === undefined) {
        return NextResponse.json({ error: 'Replaced participant not in space' }, { status: 403 });
      }

      const isOwner = spaceInfo.ownerId === participantId;

      if (isTransfer) {
        // 转让身份（Owner/Manager），如果当前用户是Owner则转让Owner，如果是Manager则转让Manager
        if (isOwner) {
          spaceInfo.ownerId = replacedId;
        } else {
          // 删除管理员列表中的当前用户，并添加新的管理员
          spaceInfo.managers = spaceInfo.managers.filter((id) => id !== participantId);
          if (!spaceInfo.managers.includes(replacedId)) {
            spaceInfo.managers.push(replacedId);
          }
        }
      } else {
        // 设置管理员, 只有Owner才有权限设置管理员
        if (!isOwner) {
          return NextResponse.json({ error: 'Only owner can set manager' }, { status: 403 });
        }
        // 设置管理员，管理员最多5个
        if (spaceInfo.managers.length < 5) {
          if (!spaceInfo.managers.includes(replacedId)) {
            spaceInfo.managers.push(replacedId);
          } else {
            // 如果已经是管理，则说明是要移除管理员
            spaceInfo.managers = spaceInfo.managers.filter((id) => id !== replacedId);
            isRemove = true;
          }
        } else {
          return NextResponse.json({ error: 'Manager limit reached' }, { status: 403 });
        }
      }
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update space managers' }, { status: 500 });
      }

      return NextResponse.json({ success: true, isRemove }, { status: 200 });
    }

    // 更新空间是否允许游客加入 -----------------------------------------------------------------------------
    if (isSpace && isUpdateAllowGuest) {
      const { spaceName, allowGuest }: AllowGuestBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      spaceInfo.allowGuest = allowGuest;
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update allow guest setting' },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 是否更新空间相关设置 -----------------------------------------------------------------------------
    if (isUpdate && isSpace) {
      const { spaceName, info }: { spaceName: string; info: Partial<SpaceInfo> } =
        await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      const updatedSpaceInfo = {
        ...spaceInfo,
        ...info,
      };
      const success = await SpaceManager.setSpaceInfo(spaceName, updatedSpaceInfo);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update space settings' }, { status: 500 });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 用户应用是否同步 -----------------------------------------------------------------------
    if (spaceAppsAPIType === 'sync') {
      const { spaceName, participantId, sync }: UpdateSpaceAppSyncBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      if (spaceInfo.participants[participantId].sync) {
        // 有则去除无则添加
        if (spaceInfo.participants[participantId].sync.includes(sync)) {
          spaceInfo.participants[participantId].sync = spaceInfo.participants[
            participantId
          ].sync.filter((s) => s !== sync);
        } else {
          spaceInfo.participants[participantId].sync.push(sync);
        }
      }

      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update app sync' }, { status: 500 });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }
    // 用户应用权限 --------------------------------------------------------------------------
    if (spaceAppsAPIType === 'auth') {
      const { spaceName, participantId, appAuth }: UpdateSpaceAppAuthBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      spaceInfo.participants[participantId].auth = appAuth;
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update app auth' }, { status: 500 });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }
    // 用户上传App到Space中 ------------------------------------------------------------------
    if (spaceAppsAPIType === 'upload') {
      const isDelete = request.nextUrl.searchParams.get('delete') === 'true';
      const { spaceName, data, ty, participantId, isAuth, deleteId }: UploadSpaceAppBody =
        await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      if (ty === 'timer') {
        spaceInfo.participants[participantId].appDatas.timer = data as SpaceTimer;
      } else if (ty === 'countdown') {
        spaceInfo.participants[participantId].appDatas.countdown = data as SpaceCountdown;
      } else {
        // 更新todo
        let targetUpdateTodo = spaceInfo.participants[participantId].appDatas.todo?.find((item) => {
          return item.date === (data as SpaceTodo).date;
        });
        if (!targetUpdateTodo) {
          // 如果没有找到则添加一个新的
          if (!spaceInfo.participants[participantId].appDatas.todo) {
            spaceInfo.participants[participantId].appDatas.todo = [];
          }
          spaceInfo.participants[participantId].appDatas.todo.push(data as SpaceTodo);
        } else {
          // 更新spaceInfo
          spaceInfo.participants[participantId].appDatas.todo = spaceInfo.participants[
            participantId
          ].appDatas.todo?.map((item) => {
            if (item.date === (data as SpaceTodo).date) {
              return data as SpaceTodo;
            } else {
              return item;
            }
          });
        }

        // 将用户的数据传到平台接口进行同步和保存
        if (isAuth) {
          if (isDelete) {
            // 删除todo
            const date = (data as SpaceTodo).date;
            const pResponse = await platformAPI.todo.deleteTodo(participantId, date, deleteId!);
            if (!pResponse.ok) {
              console.error('Failed to sync todo to platform for participant:', participantId);
            }
          } else {
            try {
              const pResponse = await platformAPI.todo.updateTodo(participantId, data as SpaceTodo);
              // 平台虽然失败但不能影响用户的使用
              if (!pResponse.ok) {
                console.error('Failed to sync todo to platform for participant:', participantId);
              }
            } catch (e) {
              console.error('Error syncing todo to platform for participant:', participantId, e);
            }
          }
        }

        if ((data as SpaceTodo).items.length > 0) {
          let currentTodo = (data as SpaceTodo).items.find((t) => {
            // 需要找到第一个未完成的(done为undefined)
            return !t.done;
          });

          if (!currentTodo) {
            // 如果没有，则取最后一个
            currentTodo = (data as SpaceTodo).items[(data as SpaceTodo).items.length - 1];
          }
          // 当todo有更新时，我们需要将用户的状态修改为`🖥️ ${todo.title}`
          // ⚠️当用户不选择公开todo时不要修改
          let targetParticipant = spaceInfo.participants[participantId];
          if (targetParticipant.sync.includes('todo')) {
            targetParticipant.status = `🖥️ ${currentTodo.title}`;
          }
        }
      }
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      return NextResponse.json({ success }, { status: 200 });
    }

    // 更新Space的持久化设置 ------------------------------------------------------------------
    if (isUpdateSpacePersistence && isSpace) {
      const { spaceName, persistence }: PersistentSpaceBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      spaceInfo.persistence = persistence;
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update space persistence' }, { status: 500 });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 更新Space的Apps ----------------------------------------------------------------------
    if (spaceAppsAPIType === 'update') {
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
      const { spaceName, participantName, participantId }: CheckNameBody = await request.json();
      // 获取房间设置
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        // 房间不存在说明是第一次创建
        return NextResponse.json({ success: true, name: participantName }, { status: 200 });
      } else {
        const pid = participantId || `${participantName}__${spaceName}`;
        const participantSettings = spaceInfo.participants[pid];
        if (participantSettings) {
          // 有参与者，判断当前参与者的online状态，如果为false，说明是重连，可以直接使用该名字
          if (participantSettings.online) {
            // 在线状态，那么不允许使用该名字
            return NextResponse.json(
              { success: false, error: 'Participant name already exists' },
              { status: 200 },
            );
          } else {
            // 离线状态，允许使用该名字
            return NextResponse.json({ success: true, name: participantName }, { status: 200 });
          }
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
      const { spaceName, settings, participantId, init }: UpdateSpaceParticipantBody =
        await request.json();
      const success = await SpaceManager.updateParticipant(
        spaceName,
        participantId,
        settings,
        init,
      );
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
    const { spaceName, participantId, status }: DefineUserStatusBody = await request.json();
    if (!spaceName || !status) {
      return NextResponse.json({ error: 'Space name and status are required' }, { status: 400 });
    }
    const { success, error } = await SpaceManager.defineStatus(spaceName, participantId, status);
    if (success) {
      return NextResponse.json({ success: true, spaceName } as DefineUserStatusResponse, {
        status: 200,
      });
    } else {
      return NextResponse.json(
        {
          error,
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
  try {
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
            let isReallyLeave = await reallyLeaveSpace(spaceId, participantId);
            if (!isReallyLeave) {
              return NextResponse.json(
                { success: false, message: 'Participant is still in the room, cannot remove.' },
                { status: 400 },
              );
            }
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
      // 在清理数据前先向服务端确认该用户是否真的离开了房间
      let isReallyLeave = await reallyLeaveSpace(spaceName, participantId);
      if (!isReallyLeave) {
        return NextResponse.json(
          { success: false, message: 'Participant is still in the room, cannot remove.' },
          { status: 400 },
        );
      }

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
  } catch (error) {
    console.error('DELETE Error:', error);
  }
}

/// 通过livekit服务端API确定用户是否真的离开了房间
const reallyLeaveSpace = async (spaceName: string, participantId: string): Promise<boolean> => {
  let hostname = LIVEKIT_URL!.replace('wss', 'https').replace('ws', 'http');
  const roomServer = new RoomServiceClient(hostname, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!);
  // 列出所有房间
  // const targetParticipant = await roomServer.getParticipant(spaceName, participantId);
  const participants = await roomServer.listParticipants(spaceName);
  if (participants.length === 0 || !participants.some((p) => p.identity === participantId)) {
    console.warn(`Participant ${participantId} not found in room ${spaceName}.`);
    return true; // 如果没有找到参与者，说明用户已经离开了房间
  }
  return false;
};

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
  let hostname = LIVEKIT_URL!.replace('wss', 'https').replace('ws', 'http');
  const roomServer = new RoomServiceClient(hostname, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!);
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
      // 检查房间是否为持久化房间
      if (redisRoom.persistence) {
        console.warn(`Skipping participant removal for persistent room: ${room.name}`);
        continue; // 跳过持久化房间的参与者清理
      }
      for (const participantId of inRedisNotInLK) {
        await SpaceManager.removeParticipant(room.name, participantId);
      }
    }

    // 处理情况2 --------------------------------------------------------------------------------------------
    if (inLKNotInRedis.length > 0) {
      for (const participant of inLKNotInRedis) {
        socket.emit('re_init', {
          space: room.name,
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
