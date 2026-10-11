import { removeSpaceFiles } from './space-files';
import { matchesCreateWhitelist as verifyCreateWhitelist } from '@vocespace/server-core';
import type { IdentityType } from '@vocespace/domain';
import type { ChatMsgItem } from '@vocespace/domain/chat';
import { ChildRoom, DEFAULT_SPACE_INFO, ParticipantSettings, SpaceInfo, SpaceInfoMap,
  SpaceDateRecords, SpaceTimeRecord, SpaceDateRecord, DEFAULT_SPACE_AUTH_CONF,
  SpaceRBACConf, handleIdentityType, RecordSettings } from '@vocespace/domain/space';
import { getConfig } from './config';
import { getServerParticipantPlatformInfo } from './platform-token';
import { getSpaceRedisClient } from './space-redis';
import { spaceRepository } from './space-repository';

const exportRBAC = (uid: string, spaceInfo?: SpaceInfo, pidentity?: string): SpaceRBACConf => {
  if (!spaceInfo) {
    return DEFAULT_SPACE_AUTH_CONF.guest;
  }

  const targetParticipant = spaceInfo.participants[uid];

  if (!targetParticipant) {
    return DEFAULT_SPACE_AUTH_CONF.guest;
  }
  const identity = handleIdentityType(
    (targetParticipant?.auth?.identity || pidentity || 'guest') as IdentityType,
  );

  return spaceInfo.auth[identity] || DEFAULT_SPACE_AUTH_CONF.guest;
};

const canCreateSpaceForParticipant = (name: string, participantId?: string | null): boolean => {
  const { create_space: createMode, whiteList: currentWhiteList } = getConfig();

  if (createMode === 'all') {
    return true;
  }

  if (createMode === 'white') {
    return verifyCreateWhitelist(name, participantId, currentWhiteList);
  }

  if (createMode === 'white_platform') {
    if (participantId) {
      return true;
    }

    return verifyCreateWhitelist(name, participantId, currentWhiteList);
  }

  return false;
};

export class SpaceManager {
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
  // 心跳日志 redis key 前缀
  private static HEARTBEAT_LOG_KEY_PREFIX = 'heartbeat:log:';
  // 心跳日志最大保留条数
  private static MAX_HEARTBEAT_LOGS = 200;
  // 清理记录 redis key 前缀 (按日期存储)
  private static CLEANUP_RECORD_KEY_PREFIX = 'cleanup:record:';
  // 清理记录最大保留条数（每天）
  private static MAX_CLEANUP_RECORDS_PER_DAY = 500;

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

  // 完全移除所有数据 相当于执行 flushdb, 只有在重新部署或版本升级出现数据结构不兼容时才需要 -------
  static async flushdb(): Promise<boolean> {
    try {
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        return true;
      }
      await redisClient.flushdb();
      return true;
    } catch (e) {
      console.error('Error clearing all data from Redis:', e);
      return false;
    }
  }

  // 删除整个空间 ------------------------------------------------------------------------
  static async deleteEntireSpace(spaceName: string): Promise<boolean> {
    try {
      const redisClient = getSpaceRedisClient();
      // 1. 直接从redis键中移除
      const spaceKey = this.getSpaceKey(spaceName);
      if (redisClient) {
        await redisClient.del(spaceKey);
      } else {
        return false;
      }

      // 3. 直接删除space:date:records:spaceName
      const spaceDataKey = `${this.SPACE_DATE_RECORDS_KEY_PREFIX}${spaceName}`;
      await redisClient.del(spaceDataKey);
      await redisClient.srem(this.SPACE_LIST_KEY_PREFIX, spaceName);
      await redisClient.del(this.getChatKey(spaceName));
      await removeSpaceFiles(spaceName);
      return true;
    } catch (e) {
      console.error('Error deleting entire space:', e);
      return false;
    }
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
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
      return (await spaceRepository.get(room)) !== null;
    } catch (error) {
      console.error('Error checking room existence:', error);
      return false;
    }
  }

  // 获取房间设置 --------------------------------------------------------------------------
  static async getSpaceInfo(space: string): Promise<SpaceInfo | null> {
    try {
      return await spaceRepository.get(space);
    } catch (error) {
      console.error('Error getting space settings:', error);
      return null;
    }
  }

  // 设置房间设置数据 -----------------------------------------------------------------------
  static async setSpaceInfo(spaceName: string, settings: SpaceInfo): Promise<boolean> {
    try {
      await spaceRepository.save(spaceName, settings);
      return true;
    } catch (error) {
      console.error('Error setting space settings:', error);
      return false;
    }
  }

  // 获取所有房间设置 -------------------------------------------------------------------
  static async getAllSpaces(): Promise<SpaceInfoMap> {
    try {
      return await spaceRepository.list();
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
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      let spaceInfo = await this.getSpaceInfo(room);
      // 房间不存在说明是第一次创建
      let startAt = Date.now();
      if (!spaceInfo) {
        if (!canCreateSpaceForParticipant(pData.name, participantId)) {
          console.warn('Blocked room creation for non-whitelisted participant', {
            room,
            participantId,
            participantName: pData.name,
          });
          return false;
        }

        const { createRoom } = getServerParticipantPlatformInfo({ user: pData });

        spaceInfo = {
          ...DEFAULT_SPACE_INFO(startAt, createRoom),
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
        // 房间存在
        // 用户重连或持久化房间用户重新上线，记录新的上线时间
        await this.setSpaceDateRecords(
          room,
          { start: spaceInfo.startAt },
          {
            [pData.name]: [{ start: startAt }],
          },
        );
      }

      const isEmptySpace = Object.keys(spaceInfo.participants).length === 0;
      // 更新参与者数据
      spaceInfo.participants[participantId] = {
        ...spaceInfo.participants[participantId],
        ...pData,
        online: true,
      };
      // 设置auth，如果发现当前空间中没有人/空间ownerId就是当前用户，那必须把auth中的identity设置为owner
      if (spaceInfo.ownerId === participantId || isEmptySpace) {
        spaceInfo.participants[participantId].auth = {
          identity: 'owner',
          platform: pData.auth?.platform || 'other',
        };
      }

      let participant = spaceInfo.participants[participantId];
      // init 时进行房间创建
      if (init) {
        const { isAuth } = getServerParticipantPlatformInfo({ user: participant });
        // 这里说明房间存在而且且用户也存在，说明用户可能是重连或房间是持久化的，我们无需大范围数据更新，只需要更新
        // 用户的最基础设置即可
        // 由于todo数据连接了平台端数据，所以这里需要更改为平台端的todo数据，但只有在isAuth为true时才更新
        let appDatas = participant.appDatas;
        if (isAuth) {
          appDatas = {
            ...appDatas,
            todo: participant.appDatas.todo,
          };
        }
        spaceInfo.participants[participantId].appDatas = appDatas;

        // 用户初始化完成之后通过RBAC获取权限，检查是否需要创建私人房间
        const { createRoom } = exportRBAC(participantId, spaceInfo);
        console.warn(createRoom, 'createRoom after exportRBAC', participantId);
        const roomName = `${spaceInfo.participants[participantId].name}'s Room`;
        if (createRoom && !spaceInfo.children.find((c) => c.name === roomName)) {
          const room = {
            name: roomName,
            isPrivate: true,
            participants: [],
            ownerId: participantId,
          } as ChildRoom;

          spaceInfo.children.push(room);
        }
      }

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
      const redisClient = getSpaceRedisClient();
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
        await removeSpaceFiles(room);
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
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }

      const spaceInfo = await this.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return false;
      }

      // Ensure the new owner exists in participants
      if (!spaceInfo.participants[newOwnerId] || /^native_[a-f0-9]{24}$/.test(newOwnerId)) {
        return false;
      }

      const oldOwnerId = spaceInfo.ownerId;
      spaceInfo.ownerId = newOwnerId;

      // Downgrade previous owner's identity according to platform
      const oldOwner = spaceInfo.participants[oldOwnerId];
      if (oldOwner) {
        if (oldOwner.auth?.platform === 'other') {
          oldOwner.auth.identity = 'guest';
        } else if (oldOwner.auth?.platform === 'c_s') {
          oldOwner.auth.identity = 'customer';
        } else {
          if (oldOwner.auth && oldOwner.auth.identity) {
            oldOwner.auth.identity = 'participant';
          }
        }
      }

      // Promote new owner
      const newOwner = spaceInfo.participants[newOwnerId];
      if (newOwner) {
        if (!newOwner.auth) {
          newOwner.auth = {
            identity: 'owner',
            platform: 'other',
          };
        } else {
          newOwner.auth.identity = 'owner';
        }
      }

      const success = await this.setSpaceInfo(spaceName, spaceInfo);
      return success;
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
      const redisClient = getSpaceRedisClient();
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
        // 需要确定参与者的身份，如果是guest则需要直接删除，guest永远不持久存储
        const { isAuth } = getServerParticipantPlatformInfo({
          user: spaceInfo.participants[participantId],
        });
        if (!isAuth) {
          console.warn('Removing guest participant from persistent room:', participantId);
          delete spaceInfo.participants[participantId];
        }
        // 检查，如果没有参与者了也需要直接删除房间
        if (spaceInfo.participants && Object.keys(spaceInfo.participants).length === 0) {
          await this.deleteSpace(room, spaceInfo.startAt);
          return {
            success: true,
            clearAll: true,
          };
        } else {
          await this.setSpaceInfo(room, spaceInfo);
        }

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
          const successor = Object.keys(spaceInfo.participants).find(
            (identity) => !/^native_[a-f0-9]{24}$/.test(identity),
          );
          if (successor) await this.transferOwner(room, successor);
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
      const redisClient = getSpaceRedisClient();
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
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        throw new Error('Redis client is not initialized or disabled.');
      }
      let spaceInfo = await this.getSpaceInfo(room);
      let startAt = Date.now();
      if (!spaceInfo) {
        spaceInfo = DEFAULT_SPACE_INFO(startAt, true);
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
      const redisClient = getSpaceRedisClient();
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

  // 心跳日志相关方法 -----------------------------------------------------------------------
  // 添加心跳日志
  static async addHeartbeatLog(
    message: string,
    type: 'info' | 'warn' | 'error' = 'info',
  ): Promise<void> {
    try {
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        console.warn('Redis client not available, skipping heartbeat log');
        return;
      }

      const key = `${this.HEARTBEAT_LOG_KEY_PREFIX}latest`;
      const logEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        message,
        type,
      };

      // 使用 list 结构存储日志，左推入
      await redisClient.lpush(key, JSON.stringify(logEntry));
      // 保留最新的 MAX_HEARTBEAT_LOGS 条
      await redisClient.ltrim(key, 0, this.MAX_HEARTBEAT_LOGS - 1);
    } catch (error) {
      console.error('Error adding heartbeat log:', error);
    }
  }

  // 获取心跳日志
  static async getHeartbeatLogs(limit: number = 100): Promise<any[]> {
    try {
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        return [];
      }

      const key = `${this.HEARTBEAT_LOG_KEY_PREFIX}latest`;
      const logs = await redisClient.lrange(key, 0, limit - 1);

      return logs.map((logStr) => {
        const log = JSON.parse(logStr);
        // 将时间戳转换为 Date 对象
        log.timestamp = new Date(log.timestamp);
        return log;
      });
    } catch (error) {
      console.error('Error getting heartbeat logs:', error);
      return [];
    }
  }

  // 清空心跳日志
  static async clearHeartbeatLogs(): Promise<boolean> {
    try {
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        return false;
      }

      const key = `${this.HEARTBEAT_LOG_KEY_PREFIX}latest`;
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Error clearing heartbeat logs:', error);
      return false;
    }
  }

  // 清理记录相关方法 -----------------------------------------------------------------------
  // 添加清理记录
  static async addCleanupRecord(
    roomName: string,
    userCount: number,
    strategy: 'ghost_room' | 'redis_no_livekit' | 'persistent_room_cleanup',
  ): Promise<void> {
    try {
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        console.warn('Redis client not available, skipping cleanup record');
        return;
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const key = `${this.CLEANUP_RECORD_KEY_PREFIX}${today}`;
      const record = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        roomName,
        userCount,
        strategy,
      };

      // 使用 list 结构存储记录，左推入
      await redisClient.lpush(key, JSON.stringify(record));
      // 保留最新的 MAX_CLEANUP_RECORDS_PER_DAY 条
      await redisClient.ltrim(key, 0, this.MAX_CLEANUP_RECORDS_PER_DAY - 1);
    } catch (error) {
      console.error('Error adding cleanup record:', error);
    }
  }

  // 获取今日清理记录
  static async getTodayCleanupRecords(page: number = 1, pageSize: number = 10): Promise<{
    records: any[];
    total: number;
  }> {
    try {
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        return { records: [], total: 0 };
      }

      const today = new Date().toISOString().split('T')[0];
      const key = `${this.CLEANUP_RECORD_KEY_PREFIX}${today}`;

      // 获取所有记录
      const allRecords = await redisClient.lrange(key, 0, -1);
      const total = allRecords.length;

      // 分页
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      const pageRecords = allRecords.slice(start, end + 1);

      const records = pageRecords.map((recordStr) => {
        const record = JSON.parse(recordStr);
        record.timestamp = new Date(record.timestamp);
        return record;
      });

      return { records, total };
    } catch (error) {
      console.error('Error getting cleanup records:', error);
      return { records: [], total: 0 };
    }
  }

  // 清空今日清理记录
  static async clearTodayCleanupRecords(): Promise<boolean> {
    try {
      const redisClient = getSpaceRedisClient();
      if (!redisClient) {
        return false;
      }

      const today = new Date().toISOString().split('T')[0];
      const key = `${this.CLEANUP_RECORD_KEY_PREFIX}${today}`;
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Error clearing cleanup records:', error);
      return false;
    }
  }
}
