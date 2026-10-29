import { parsePageLimit } from '@vocespace/contracts';
import { verifyHostToken } from '../lib/server/host-authorization';
import { sessions, sessionToken } from '../lib/server/sessions';
import { SpaceManager } from '../lib/server/legacy-space-manager';
// /app/api/space/route.ts
import {
  AuthType,
  ChildRoomEnter,
  DEFAULT_TOKEN_RESULT,
  ERROR_CODE,
  IdentityType,
  isUndefinedString,
  splitPlatformUser,
} from '@vocespace/domain';
import { ApiRequest, ApiResponse } from '../http';
import { ChatMsgItem } from '@vocespace/domain/chat';
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
  DEFAULT_SPACE_AUTH_CONF,
  SpaceRBACConf,
  handleIdentityType,
} from '@vocespace/domain/space';
import { RoomServiceClient } from 'livekit-server-sdk';
import { notifyParticipantReinit } from '../lib/realtime/server';
import { WsParticipant } from '@vocespace/domain/socket';
import {
  AllowGuestBody,
  CheckNameBody,
  DefineUserStatusBody,
  DefineUserStatusResponse,
  DeleteSpaceParticipantBody,
  EnterRoomBody,
  PersistentSpaceBody,
  TransOrSetOMBody,
  UpdateAuthRBACConfBody,
  UpdateOwnerIdBody,
  UpdateSpaceAppAuthBody,
  UpdateSpaceAppsBody,
  UpdateSpaceAppSyncBody,
  UpdateSpaceParticipantBody,
  UploadSpaceAppBody,
  WorkModeBody,
} from '@vocespace/domain/requests/space';
import { UpdateRecordBody } from '@vocespace/domain/requests/record';
import {
  ChildRoomMethods,
  CreateRoomBody,
  DeleteRoomBody,
  JoinRoomBody,
  LeaveRoomBody,
  UpdateRoomBody,
} from '@vocespace/domain/requests/channel';
import { getConfig } from '../lib/server/config';
import { platformAPI } from '../lib/server/platform';
import { generateToken, getServerParticipantPlatformInfo } from '../lib/server/platform-token';





// 获取房间所有参与者设置
export async function GET(request: ApiRequest) {
  const isAll = request.nextUrl.searchParams.get('all') === 'true';
  const spaceName = request.nextUrl.searchParams.get('spaceName');
  const isPre = request.nextUrl.searchParams.get('pre') === 'true';
  const isTimeRecord = request.nextUrl.searchParams.get('timeRecord') === 'true';
  const isChat = request.nextUrl.searchParams.get('chat') === 'true';
  const isHistory = request.nextUrl.searchParams.get('history') === 'true';
  const isCreateSpace = request.nextUrl.searchParams.get('space') === 'create';
  const isHeartbeat = request.nextUrl.searchParams.get('heartbeat') === 'true';
  const isHeartbeatLog = request.nextUrl.searchParams.get('heartbeatLog') === 'true';
  const isClearHeartbeatLog = request.nextUrl.searchParams.get('clearHeartbeatLog') === 'true';
  const isCleanupRecords = request.nextUrl.searchParams.get('cleanupRecords') === 'true';
  const isClearCleanupRecords = request.nextUrl.searchParams.get('clearCleanupRecords') === 'true';
  // 获取心跳日志 --------------------------------------------------------------------------
  if (isHeartbeatLog) {
    const limit = parsePageLimit(request.nextUrl.searchParams.get('limit'));
    const logs = await SpaceManager.getHeartbeatLogs(limit);
    return ApiResponse.json({ logs }, { status: 200 });
  }
  // 清空心跳日志 --------------------------------------------------------------------------
  if (isClearHeartbeatLog) {
    const success = await SpaceManager.clearHeartbeatLogs();
    return ApiResponse.json({ success }, { status: 200 });
  }
  // 获取今日清理记录 ----------------------------------------------------------------------
  if (isCleanupRecords) {
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
    const pageSize = parsePageLimit(request.nextUrl.searchParams.get('pageSize') || '10');
    const { records, total } = await SpaceManager.getTodayCleanupRecords(page, pageSize);
    return ApiResponse.json({ records, total, page, pageSize }, { status: 200 });
  }
  // 清空今日清理记录 ----------------------------------------------------------------------
  if (isClearCleanupRecords) {
    const success = await SpaceManager.clearTodayCleanupRecords();
    return ApiResponse.json({ success }, { status: 200 });
  }
  // 心跳接口，检查房间是否存在和用户是否在线 ------------------------------------------------------
  if (isHeartbeat) {
    // 无论如何都返回成功，这里只是一个触发器
    return ApiResponse.json({ success: true }, { status: 200 });
  }
  // 创建一个新的空间 -------------------------------------------------------------------------------
  if (isCreateSpace) {
    const spaceOwner = request.nextUrl.searchParams.get('owner');
    const creator = await sessions.read(sessionToken(request.headers));
    const ownerId = creator?.identities[spaceName || spaceOwner || ''];
    if (!spaceOwner) {
      return ApiResponse.json({ error: ERROR_CODE.createSpace.ParamLack }, { status: 200 });
    } else {
      // 如果有spaceName这个参数则使用这个作为空间名字，否则使用owner作为空间名字
      let realSpaceName = spaceName || spaceOwner;
      const spaceInfo = await SpaceManager.getSpaceInfo(realSpaceName);
      if (spaceInfo) {
        return ApiResponse.json({ error: ERROR_CODE.createSpace.SpaceExist }, { status: 200 });
      }
      const newSpaceInfo = {
        ...DEFAULT_SPACE_INFO(Date.now(), true),
        ownerId: ownerId || `${spaceOwner}__${spaceOwner}`,
      } as SpaceInfo;

      await SpaceManager.setSpaceInfo(realSpaceName, newSpaceInfo);
      return ApiResponse.json({ success: true }, { status: 200 });
    }
  }
  // 获取某个空间的聊天记录 --------------------------------------------------------------------------
  if (isChat && isHistory && spaceName) {
    const chatMessages = await SpaceManager.getChatMessages(spaceName);
    return ApiResponse.json(
      {
        msgs: chatMessages,
      },
      { status: 200 },
    );
  }

  // 如果是时间记录，则返回所有空间的使用情况 ------------------------------------------------------------
  if (isTimeRecord) {
    const allSpaceDateRecords = await SpaceManager.getAllSpaceDateRecords();
    return ApiResponse.json(
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
      return ApiResponse.json(allSpaces, { status: 200 });
    } else {
      // 将roomSettings转为Map形式 Map<spaceName, participants>
      const roomSettingsMap = Object.entries(allSpaces).reduce(
        (acc, [spaceName, { participants }]) => {
          acc[spaceName] = Object.keys(participants);
          return acc;
        },
        {} as Record<string, string[]>,
      );

      return ApiResponse.json(roomSettingsMap);
    }
  }
  // 生成一个可用的用户名字 -----------------------------------------------------------------------------
  if (isPre && spaceName) {
    const availableUserName = await SpaceManager.genUserName(spaceName);
    return ApiResponse.json({
      name: availableUserName,
    });
  }
  // 获取某个房间的数据 ---------------------------------------------------------------------------------
  if (spaceName) {
    let spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
    const viewer = await sessions.read(sessionToken(request.headers));
    if (spaceInfo && !viewer?.identities[spaceName] && !verifyHostToken(request.headers.get('x-vocespace-host-token'))) {
      spaceInfo = { ...DEFAULT_SPACE_INFO(0, false), allowGuest: spaceInfo.allowGuest };
    }
    return ApiResponse.json(
      {
        exists: !!spaceInfo,
        settings: spaceInfo || { participants: {} },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  }

  return ApiResponse.json({ error: 'Invalid request' }, { status: 400 });
}

// 更新单个参与者设置
export async function POST(request: ApiRequest) {
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
    const isIframe = request.nextUrl.searchParams.get('iframe') === 'url';
    const isTransfer = request.nextUrl.searchParams.get('transfer') === 'true';
    const authManage = request.nextUrl.searchParams.get('auth');
    const mode = request.nextUrl.searchParams.get('mode');
    // 更新 rbac 配置 -----------------------------------------------------------------------------
    if (isSpace && isUpdate && authManage === 'rbac') {
      const { spaceName, authConf }: UpdateAuthRBACConfBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      spaceInfo.auth = authConf;
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return ApiResponse.json({ error: 'Failed to update rbac configuration' }, { status: 500 });
      }
      return ApiResponse.json({ success: true }, { status: 200 });
    }
    // 开启/关闭 工作模式 -------------------------------------------------------------------------
    if (mode === 'work') {
      const { spaceName, participantId, workType }: WorkModeBody = await request.json();
      // 获取空间信息和用户信息
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      const participant = spaceInfo.participants[participantId];
      if (!participant) {
        return ApiResponse.json({ error: 'Participant not found' }, { status: 404 });
      }
      // 先检测当前用户的work和传入的workType是否一致，如果一致则直接返回成功，因为已经是这个状态了
      if (workType === participant.work.enabled) {
        return ApiResponse.json({ success: true, workType }, { status: 200 });
      }

      // 如果是关闭工作模式
      // 通过用户的work结构中的配置还原用户的视频模糊度和屏幕模糊度，并设置enabled字段为false
      if (!workType) {
        participant.blur = participant.work.videoBlur;
        participant.screenBlur = participant.work.screenBlur;
        // 将work结构设置为DEFAULT
        participant.work = DEFAULT_PARTICIPANT_WORK_CONF;
        await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
        return ApiResponse.json({ success: true, workType }, { status: 200 });
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
        return ApiResponse.json({ success: true, workType }, { status: 200 });
      }
    }
    // 用户身份处理 -----------------------------------------------------------------------------
    if (isSpace && authManage === 'manage') {
      let isRemove = false;
      const { spaceName, participantId, replacedId }: TransOrSetOMBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      // 先确定participantId的是否在当前的space中
      if (spaceInfo.participants[participantId] === undefined) {
        return ApiResponse.json({ error: 'Participant not in space' }, { status: 403 });
      }

      if (spaceInfo.participants[replacedId] === undefined) {
        return ApiResponse.json({ error: 'Replaced participant not in space' }, { status: 403 });
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
          return ApiResponse.json({ error: 'Only owner can set manager' }, { status: 403 });
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
          return ApiResponse.json({ error: 'Manager limit reached' }, { status: 403 });
        }
      }
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return ApiResponse.json({ error: 'Failed to update space managers' }, { status: 500 });
      }

      return ApiResponse.json({ success: true, isRemove }, { status: 200 });
    }

    // 更新空间是否允许游客加入 -----------------------------------------------------------------------------
    if (isSpace && isUpdateAllowGuest) {
      const { spaceName, allowGuest }: AllowGuestBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      spaceInfo.allowGuest = allowGuest;
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return ApiResponse.json(
          { error: 'Failed to update allow guest setting' },
          { status: 500 },
        );
      }
      return ApiResponse.json({ success: true }, { status: 200 });
    }

    // 更新 iframe URL 记录 --------------------------------------------------------------------
    if (isSpace && isUpdate && isIframe) {
      const { spaceName, iframeUrl }: { spaceName: string; iframeUrl: string } =
        await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      if (!spaceInfo.iframeUrls) {
        spaceInfo.iframeUrls = [];
      }
      if (!spaceInfo.iframeUrls.includes(iframeUrl)) {
        spaceInfo.iframeUrls.push(iframeUrl);
      }
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return ApiResponse.json(
          { error: 'Failed to update iframe URLs' },
          { status: 500 },
        );
      }
      return ApiResponse.json({ success: true }, { status: 200 });
    }

    // 是否更新空间相关设置 -----------------------------------------------------------------------------
    if (isUpdate && isSpace) {
      const { spaceName, info }: { spaceName: string; info: Partial<SpaceInfo> } =
        await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      const updatedSpaceInfo = {
        ...spaceInfo,
        ...info,
      };
      const success = await SpaceManager.setSpaceInfo(spaceName, updatedSpaceInfo);
      if (!success) {
        return ApiResponse.json({ error: 'Failed to update space settings' }, { status: 500 });
      }
      return ApiResponse.json({ success: true }, { status: 200 });
    }

    // 用户应用是否同步 -----------------------------------------------------------------------
    if (spaceAppsAPIType === 'sync') {
      const { spaceName, participantId, sync }: UpdateSpaceAppSyncBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
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
        return ApiResponse.json({ error: 'Failed to update app sync' }, { status: 500 });
      }
      return ApiResponse.json({ success: true }, { status: 200 });
    }
    // 用户应用权限 --------------------------------------------------------------------------
    if (spaceAppsAPIType === 'auth') {
      const { spaceName, participantId, appAuth }: UpdateSpaceAppAuthBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      spaceInfo.participants[participantId].appAuth = appAuth;
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return ApiResponse.json({ error: 'Failed to update app auth' }, { status: 500 });
      }
      return ApiResponse.json({ success: true }, { status: 200 });
    }
    // 用户上传App到Space中 ------------------------------------------------------------------
    if (spaceAppsAPIType === 'upload') {
      const isDelete = request.nextUrl.searchParams.get('delete') === 'true';
      const { spaceName, data, ty, participantId, isAuth, deleteId }: UploadSpaceAppBody =
        await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
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
      return ApiResponse.json({ success }, { status: 200 });
    }

    // 更新Space的持久化设置 ------------------------------------------------------------------
    if (isUpdateSpacePersistence && isSpace) {
      const { spaceName, persistence }: PersistentSpaceBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
      }
      spaceInfo.persistence = persistence;
      const success = await SpaceManager.setSpaceInfo(spaceName, spaceInfo);
      if (!success) {
        return ApiResponse.json({ error: 'Failed to update space persistence' }, { status: 500 });
      }
      return ApiResponse.json({ success: true }, { status: 200 });
    }

    // 更新Space的Apps ----------------------------------------------------------------------
    if (spaceAppsAPIType === 'update') {
      const { spaceName, appKey, enabled }: UpdateSpaceAppsBody = await request.json();
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      if (!spaceInfo) {
        return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
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
        return ApiResponse.json({ error: 'Failed to update space apps' }, { status: 500 });
      }
      return ApiResponse.json({ success: true }, { status: 200 });
    }

    // 处理用户唯一名 -------------------------------------------------------------------------
    if (isNameCheck) {
      const { spaceName, participantName }: CheckNameBody = await request.json();
      if (
        typeof spaceName !== 'string' || !spaceName ||
        typeof participantName !== 'string' || !participantName.trim()
      ) {
        return ApiResponse.json({ error: 'Invalid username request' }, { status: 400 });
      }
      const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
      const viewer = await sessions.read(sessionToken(request.headers));
      // Names are display values; participant IDs now come from the trusted session.
      // A caller-supplied participantId must not exempt another user's name from checking.
      const ownId = viewer?.identities[spaceName];
      const existingNames = new Set(
        Object.entries(spaceInfo?.participants || {})
          .filter(([id, participant]) => id !== ownId && participant.online)
          .map(([, participant]) => participant.name),
      );
      const requestedName = participantName.trim();
      let name = requestedName;
      for (let suffix = 2; existingNames.has(name); suffix++) {
        name = `${requestedName} ${String(suffix).padStart(2, '0')}`;
      }
      return ApiResponse.json({ success: true, name }, { status: 200 });
    }

    // 如果是创建子房间/进入子房间 -------------------------------------------------------------------------
    if (isChildRoom) {
      const enter = request.nextUrl.searchParams.get('enter');
      // 进入子房间的处理 -----------------------------------------------------------------------------
      if (enter === 'true') {
        const { space, auth, uid, room, identity, username }: EnterRoomBody = await request.json();
        // 无需处理
        if (room === '$space') {
          return ApiResponse.json({ success: true }, { status: 200 });
        }
        // 获取space信息
        const spaceInfo = await SpaceManager.getSpaceInfo(space);
        if (!spaceInfo) {
          return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
        }
        // 先判断auth，如果是c_s, 说明进入了customer - service模式，用户需要进入某个空闲房间
        // 这里的空闲房间指的是某个私人房间，且这个私人房间只有房间拥有者(客服)一个人，顾客需要进入这个房间
        // 这是个一对一的模式
        if (auth === 'c_s') {
          // 判断用户身份
          if (identity === 'assistant') {
            // 助理直接进入自己的私人房间或者创建房间
            // 这里一般来说，客服都会指定一个房间名
            const existingRoom =
              room === '$empty'
                ? null
                : spaceInfo.children.find((child) => child.ownerId === uid && child.name === room);
            // 房间存在
            if (existingRoom) {
              // 如果这个房间不是私人房间，且内部已经有超过一个人了，那么设置这个房间为私人房间，并清理内部所有人，再进入
              if (!existingRoom.isPrivate) {
                existingRoom.isPrivate = true;
              }

              if (existingRoom.participants.length >= 1) {
                existingRoom.participants = [uid];
              } else {
                existingRoom.participants.push(uid);
              }
              await SpaceManager.setSpaceInfo(space, spaceInfo);
              return ApiResponse.json({ success: true }, { status: 200 });
            } else {
              // 创建新的私人房间
              const newChildRoom: ChildRoom = {
                name: room || `${username}'s Room`,
                participants: [uid],
                ownerId: uid,
                isPrivate: true,
              };
              const { success, error } = await SpaceManager.setChildRoom(space, newChildRoom);
              if (success) {
                return ApiResponse.json({ success: true }, { status: 200 });
              } else {
                return ApiResponse.json({ error }, { status: 500 });
              }
            }
          } else if (identity === 'customer') {
            // 这里一般来说，客服都会指定一个房间名
            const existingRoom =
              room === '$empty' ? null : spaceInfo.children.find((child) => child.name === room);
            // 如果是顾客
            if (existingRoom) {
              // 房间存在，我们需要检查这个房间是否满人(一对一场景下，支持2个人在一个房间内)
              if (existingRoom.participants.length >= 2) {
                // 满人则寻找其他空闲房间，找到一个就让用户进入
                const freeRoom = spaceInfo.children.find(
                  (child) =>
                    child.isPrivate &&
                    child.participants.length === 1 && // 只有房主一个人
                    child.ownerId !== existingRoom.ownerId, // 不能是同一个客服的房间
                );
                if (freeRoom) {
                  freeRoom.participants.push(uid);
                  await SpaceManager.setSpaceInfo(space, spaceInfo);
                  return ApiResponse.json({ success: true }, { status: 200 });
                } else {
                  return ApiResponse.json(
                    {
                      error: 'No available rooms, please wait...',
                      code: ERROR_CODE.enterRoom.FullAndWait,
                    },
                    { status: 200 },
                  );
                }
              } else {
                // 没有满人，直接加入
                existingRoom.participants.push(uid);
                await SpaceManager.setSpaceInfo(space, spaceInfo);
                return ApiResponse.json({ success: true }, { status: 200 });
              }
            } else {
              // 房间不存在，说明客服还没有创建房间，直接返回错误让用户等待
              return ApiResponse.json(
                {
                  error: 'No available rooms, please wait...',
                  code: ERROR_CODE.enterRoom.NotExist,
                },
                { status: 200 },
              );
            }
          } else {
            // 其他身份不在c_s模式下工作
            return ApiResponse.json(
              {
                error: 'Invalid identity for c_s mode',
                code: ERROR_CODE.enterRoom.InvalidIdentityCS,
              },
              { status: 200 },
            );
          }
        } else {
          // 非c_s模式下，直接加入指定房间，如果不存在就创建，有就直接加入
          if (!room) {
            // 没有指定room字段的情况，在其他模式下无需加入任何room
            return ApiResponse.json({ success: true }, { status: 200 });
          }

          const existingRoom = spaceInfo.children.find((child) => child.name === room);
          if (existingRoom) {
            // 房间存在，加入房间，无论是否私人房间都可以加入
            if (!existingRoom.participants.includes(uid)) {
              existingRoom.participants.push(uid);
              await SpaceManager.setSpaceInfo(space, spaceInfo);
            }
            return ApiResponse.json({ success: true }, { status: 200 });
          } else {
            // 房间不存在，创建新房间
            const newChildRoom: ChildRoom = {
              name: room || `${username}'s Room`,
              participants: [uid],
              ownerId: uid,
              isPrivate: true,
            };
            const { success, error } = await SpaceManager.setChildRoom(space, newChildRoom);
            if (success) {
              return ApiResponse.json({ success: true }, { status: 200 });
            } else {
              return ApiResponse.json({ error }, { status: 500 });
            }
          }
        }
      } else if (enter === 'link') {
        const { space, room, roomOwner, platUser }: ChildRoomEnter = await request.json();
        // 检查space
        const spaceInfo = await SpaceManager.getSpaceInfo(space);
        if (!spaceInfo) {
          return ApiResponse.json({ error: 'Space not found' }, { status: 404 });
        }
        // 查找对应的子房间
        const targetRoom = spaceInfo.children.find((child) => child.name === room);
        if (!targetRoom) {
          return ApiResponse.json({ error: 'Child room not found' }, { status: 404 });
        }
        if (targetRoom.isPrivate) {
          // 私密房间，需要验证room owner
          if (targetRoom.ownerId !== roomOwner) {
            return ApiResponse.json(
              { error: 'Unauthorized to enter private room' },
              { status: 403 },
            );
          }
        }

        const principal = await sessions.read(sessionToken(request.headers));
        if (!principal) return ApiResponse.json({ code: 'SESSION_REQUIRED' }, { status: 401 });
        const platform = principal.platform;
        const now = Math.floor(Date.now() / 1000);
        const username = platform?.username || await SpaceManager.genUserName(space);
        const id = principal.identities[space] || `guest_${principal.id.slice(0, 24)}`;
        const code = await sessions.code({ ...DEFAULT_TOKEN_RESULT(space, username, room),
          id, auth: platform?.auth || 'other', identity: platform?.identity || 'guest',
          iat: now, exp: now + 3600 });
        const url = new URL(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${encodeURIComponent(space)}`, request.nextUrl.origin);
        url.searchParams.set('code', code);
        return ApiResponse.json({ redirectUrl: url.toString() });
      }

      // 创建子房间的处理 -----------------------------------------------------------------------------
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
        return ApiResponse.json({ success: true }, { status: 200 });
      } else {
        return ApiResponse.json({ error }, { status: 500 });
      }
    }

    // 处理录制 --------------------------------------------------------------------------------
    if (isUpdateRecord) {
      const { spaceName, record }: UpdateRecordBody = await request.json();
      const { success, error } = await SpaceManager.updateRecordSettings(spaceName, record);

      if (success) {
        const spaceInfo = await SpaceManager.getSpaceInfo(spaceName);
        return ApiResponse.json({ success: true, record: spaceInfo?.record }, { status: 200 });
      } else {
        return ApiResponse.json(
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
        return ApiResponse.json({ success: true, ownerId: participantId }, { status: 200 });
      } else {
        return ApiResponse.json({ error: 'Failed to transfer ownership' }, { status: 500 });
      }
    }
    // 更新参与者设置 ---------------------------------------------------------------------------
    if (isUpdateParticipant && isSpace) {
      const { spaceName, settings, participantId, init }: UpdateSpaceParticipantBody =
        await request.json();
      const outcome: { created?: boolean } = {};
      const success = await SpaceManager.updateParticipant(
        spaceName,
        participantId,
        settings,
        init,
        outcome,
      );
      return ApiResponse.json({ success, created: success && outcome.created === true }, { status: 200 });
    }

    return ApiResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error updating room settings:', error);
    return ApiResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

export async function PUT(request: ApiRequest) {
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
        return ApiResponse.json(
          { success: true, message: 'Child room renamed successfully' },
          { status: 200 },
        );
      } else {
        return ApiResponse.json(
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
        return ApiResponse.json(
          { success: true, message: 'Child room privacy updated successfully' },
          { status: 200 },
        );
      } else {
        return ApiResponse.json(
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
      return ApiResponse.json({ success: true }, { status: 200 });
    }
    return ApiResponse.json(
      { success: false, error: error || 'Failed to add participant to child room' },
      { status: 500 },
    );
  }
  // 用户自定义状态 -------------------------------------------------------------------------------------
  if (isDefineStatus) {
    const { spaceName, participantId, status }: DefineUserStatusBody = await request.json();
    if (!spaceName || !status) {
      return ApiResponse.json({ error: 'Space name and status are required' }, { status: 400 });
    }
    const { success, error } = await SpaceManager.defineStatus(spaceName, participantId, status);
    if (success) {
      return ApiResponse.json({ success: true, spaceName } as DefineUserStatusResponse, {
        status: 200,
      });
    } else {
      return ApiResponse.json(
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
export async function DELETE(request: ApiRequest) {
  const socketId = request.nextUrl.searchParams.get('socketId');
  const childRoom = request.nextUrl.searchParams.get('childRoom') as ChildRoomMethods | null;
  const isDeleteParticipant = request.nextUrl.searchParams.get('participant') === 'delete';
  const isSpaceDelete = request.nextUrl.searchParams.get('delete') === 'true';
  const isSpace = request.nextUrl.searchParams.get('space') === 'true';
  const isFlushDB = request.nextUrl.searchParams.get('flushdb') === 'true';
  try {
    //执行清理整个redis操作 ---------------------------------------------------------------------------
    if (isFlushDB) {
      // 检测hostToken是否正确，只有正确的hostToken才能执行清理操作
      const { hostToken } = await request.json();
      if (hostToken !== getConfig().hostToken) {
        return ApiResponse.json(
          { success: false, message: 'Invalid host token' },
          { status: 403 },
        );
      }
      const success = await SpaceManager.flushdb();
      if (success) {
        return ApiResponse.json({ success: true, message: 'All spaces cleared successfully' });
      } else {
        return ApiResponse.json(
          { success: false, message: 'Failed to clear spaces' },
          { status: 500 },
        );
      }
    }
    // 删除整个Space ---------------------------------------------------------------------------------
    if (isSpaceDelete && isSpace) {
      const { spaceName } = await request.json();
      const success = await SpaceManager.deleteEntireSpace(spaceName);
      if (success) {
        return ApiResponse.json({ success: true, message: 'Space deleted successfully' });
      } else {
        return ApiResponse.json(
          { success: false, message: 'Failed to delete space' },
          { status: 500 },
        );
      }
    }
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
        return ApiResponse.json({ success: true, message: 'Participant removed from child room' });
      } else {
        return ApiResponse.json(
          { success: false, message: 'Failed to remove participant from child room', error },
          { status: 500 },
        );
      }
    } else if (childRoom === ChildRoomMethods.DELETE) {
      // 删除子房间 ----------------------------------------------------------------------------------------------
      const { spaceName, roomName }: DeleteRoomBody = await request.json();
      const success = await SpaceManager.deleteChildRoom(spaceName, roomName);
      if (success) {
        return ApiResponse.json({ success: true, message: 'Child room deleted successfully' });
      } else {
        return ApiResponse.json(
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
              return ApiResponse.json(
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
                return ApiResponse.json({ success: true, space: spaceId, clearRoom: spaceId });
              }
              return ApiResponse.json({
                space: spaceId,
                success: true,
                message: 'Participant removed successfully',
              });
            } else {
              return ApiResponse.json(
                { success: false, message: 'Failed to remove participant', error },
                { status: 500 },
              );
            }
          }
        }
      }

      // 如果循环结束后没有找到参与者
      if (!participantFound) {
        return ApiResponse.json(
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
        return ApiResponse.json(
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
          return ApiResponse.json({ success: true, clearSpace: spaceName });
        }
        return ApiResponse.json({ success: true, message: 'Participant removed successfully' });
      }

      return ApiResponse.json(
        { success: false, message: 'Failed to remove participant', error },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('DELETE Error:', error);
    return ApiResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
  // 如果没有任何分支命中，返回 Bad Request
  return ApiResponse.json({ error: 'Invalid request' }, { status: 400 });
}

/// 通过livekit服务端API确定用户是否真的离开了房间
const reallyLeaveSpace = async (spaceName: string, participantId: string): Promise<boolean> => {
  const { livekit: { url: LIVEKIT_URL, key: LIVEKIT_API_KEY, secret: LIVEKIT_API_SECRET } } = getConfig();
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
export const userHeartbeat = async () => {
  const { livekit: { url: LIVEKIT_URL, key: LIVEKIT_API_KEY, secret: LIVEKIT_API_SECRET } } = getConfig();
  const startTime = Date.now();
  console.log('Running user heartbeat check...');
  await SpaceManager.addHeartbeatLog('开始执行用户心跳检测...', 'info');

  try {
    if (
      isUndefinedString(LIVEKIT_API_KEY) ||
      isUndefinedString(LIVEKIT_API_SECRET) ||
      isUndefinedString(LIVEKIT_URL)
    ) {
      console.warn("URL: ", LIVEKIT_URL);
      console.warn('LiveKit API credentials are not set, skipping user heartbeat check.');
      await SpaceManager.addHeartbeatLog('LiveKit API 配置未设置，跳过心跳检测', 'warn');
      return;
    }

    let hostname = LIVEKIT_URL!.replace('wss', 'https').replace('ws', 'http');
    const roomServer = new RoomServiceClient(hostname, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!);
    
    // 获取 LiveKit 中的所有房间
    const lkRooms = await roomServer.listRooms();
    const lkRoomNames = new Set(lkRooms.map((r) => r.name));
    await SpaceManager.addHeartbeatLog(`LiveKit 中有 ${lkRooms.length} 个活跃房间`, 'info');

    // 获取 Redis 中的所有房间
    const redisRooms = await SpaceManager.getAllSpaces();
    const redisRoomNames = Object.keys(redisRooms);
    await SpaceManager.addHeartbeatLog(`Redis 中有 ${redisRoomNames.length} 个房间`, 'info');

    let totalRemoved = 0;
    let totalReInit = 0;
    let totalGhostRooms = 0;
    let totalPersistentRoomCleanups = 0;

    // 场景1: 清理 Redis 中存在但 LiveKit 中不存在的幽灵房间
    const ghostRooms = redisRoomNames.filter((name) => !lkRoomNames.has(name));
    if (ghostRooms.length > 0) {
      await SpaceManager.addHeartbeatLog(
        `发现 ${ghostRooms.length} 个幽灵房间 (Redis有但LiveKit无): [${ghostRooms.join(', ')}]`,
        'warn',
      );

      for (const roomName of ghostRooms) {
        const redisRoom = redisRooms[roomName];
        const participantCount = Object.keys(redisRoom.participants).length;

        // 检查是否为持久化房间
        if (redisRoom.persistence) {
          await SpaceManager.addHeartbeatLog(
            `持久化房间 [${roomName}] 在 LiveKit 中不存在，仅清理参与者数据，保留房间配置`,
            'info',
          );

          // 持久化房间：只清理参与者，保留房间数据
          for (const participantId of Object.keys(redisRoom.participants)) {
            try {
              await SpaceManager.removeParticipant(roomName, participantId);
              const participantName = redisRoom.participants[participantId]?.name || participantId;
              await SpaceManager.addHeartbeatLog(
                `✓ 已从持久化房间 [${roomName}] 移除参与者: ${participantName} (${participantId})`,
                'info',
              );
              totalRemoved++;
            } catch (removeError) {
              await SpaceManager.addHeartbeatLog(
                `✗ 移除持久化房间参与者 ${participantId} 失败: ${removeError instanceof Error ? removeError.message : '未知错误'}`,
                'error',
              );
            }
          }
          // 记录清理数据（持久化房间清理参与者）
          if (participantCount > 0) {
            await SpaceManager.addCleanupRecord(roomName, participantCount, 'persistent_room_cleanup');
            totalPersistentRoomCleanups++;
          }
        } else {
          // 非持久化房间：删除整个房间
          await SpaceManager.addHeartbeatLog(
            `清理幽灵房间 [${roomName}]，包含 ${participantCount} 个参与者`,
            'warn',
          );

          try {
            await SpaceManager.deleteSpace(roomName, Date.now());
            await SpaceManager.addHeartbeatLog(
              `✓ 已删除幽灵房间: ${roomName}`,
              'info',
            );
            // 记录清理数据
            await SpaceManager.addCleanupRecord(roomName, participantCount, 'ghost_room');
            totalGhostRooms++;
            totalRemoved += participantCount;
          } catch (deleteError) {
            await SpaceManager.addHeartbeatLog(
              `✗ 删除幽灵房间 ${roomName} 失败: ${deleteError instanceof Error ? deleteError.message : '未知错误'}`,
              'error',
            );
          }
        }
      }
    }

    // 场景2: 处理 LiveKit 和 Redis 都存在的房间，对比参与者
    for (const room of lkRooms) {
      const roomParticipants = await roomServer.listParticipants(room.name);
      const redisRoom = await SpaceManager.getSpaceInfo(room.name);
      if (!redisRoom) {
        await SpaceManager.addHeartbeatLog(
          `房间 [${room.name}] 在 Redis 中不存在，跳过`,
          'warn',
        );
        continue;
      }

      const redisParticipants = Object.keys(redisRoom.participants);
      
      // 打印调试信息
      const lkIdentities = roomParticipants.map((p) => p.identity);
      await SpaceManager.addHeartbeatLog(
        `房间 [${room.name}] - LiveKit 参与者: [${lkIdentities.join(', ')}]`,
        'info',
      );
      await SpaceManager.addHeartbeatLog(
        `房间 [${room.name}] - Redis 参与者: [${redisParticipants.join(', ')}]`,
        'info',
      );

      // 找出 Redis 中有但 LiveKit 中没有的参与者（已离线）
      const inRedisNotInLK = redisParticipants.filter((p) => {
        return !roomParticipants.some((lkParticipant) => lkParticipant.identity === p);
      });

      // 找出 LiveKit 中有但 Redis 中没有的参与者（需要重新初始化）
      const inLKNotInRedis = roomParticipants.filter((lkParticipant) => {
        return !redisParticipants.includes(lkParticipant.identity);
      });

      await SpaceManager.addHeartbeatLog(
        `房间 [${room.name}] - 需要清理 (Redis有但LiveKit无): [${inRedisNotInLK.join(', ')}]`,
        'info',
      );
      await SpaceManager.addHeartbeatLog(
        `房间 [${room.name}] - 需要重新初始化 (LiveKit有但Redis无): [${inLKNotInRedis.map((p) => p.identity).join(', ')}]`,
        'info',
      );

      // 清理离线用户
      if (inRedisNotInLK.length > 0) {
        await SpaceManager.addHeartbeatLog(
          `房间 [${room.name}] 发现 ${inRedisNotInLK.length} 个离线用户需要清理: ${inRedisNotInLK.join(', ')}`,
          'warn',
        );

        for (const participantId of inRedisNotInLK) {
          try {
            await SpaceManager.removeParticipant(room.name, participantId);
            const participantName = redisRoom.participants[participantId]?.name || participantId;
            await SpaceManager.addHeartbeatLog(
              `✓ 已从房间 [${room.name}] 移除离线用户: ${participantName} (${participantId})`,
              'info',
            );
            totalRemoved++;
          } catch (removeError) {
            await SpaceManager.addHeartbeatLog(
              `✗ 移除用户 ${participantId} 失败: ${removeError instanceof Error ? removeError.message : '未知错误'}`,
              'error',
            );
          }
        }
        // 记录清理数据（有Redis无LiveKit的参与者）
        await SpaceManager.addCleanupRecord(room.name, inRedisNotInLK.length, 'redis_no_livekit');
      }

      // 重新初始化用户
      if (inLKNotInRedis.length > 0) {
        const identities = inLKNotInRedis.map((p) => p.identity).join(', ');
        await SpaceManager.addHeartbeatLog(
          `房间 [${room.name}] 发现 ${inLKNotInRedis.length} 个用户需要重新初始化: ${identities}`,
          'warn',
        );

        for (const participant of inLKNotInRedis) {
          notifyParticipantReinit({
            space: room.name,
            participantId: participant.identity,
          } as WsParticipant);
          await SpaceManager.addHeartbeatLog(
            `✓ 已发送重新初始化请求给用户: ${participant.identity}`,
            'info',
          );
          totalReInit++;
        }
      }

      if (inRedisNotInLK.length === 0 && inLKNotInRedis.length === 0) {
        await SpaceManager.addHeartbeatLog(
          `房间 [${room.name}] 状态正常，无需处理`,
          'info',
        );
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = `心跳检测完成: 耗时 ${duration}s, 清理 ${totalGhostRooms} 个幽灵房间, 清理 ${totalPersistentRoomCleanups} 个持久化房间参与者, 清理 ${totalRemoved} 个离线用户, 重新初始化 ${totalReInit} 个用户`;
    await SpaceManager.addHeartbeatLog(summary, 'info');
    console.log(summary);
  } catch (error) {
    const errorMsg = `心跳检测出错: ${error instanceof Error ? error.message : '未知错误'}`;
    console.error('Error in userHeartbeat:', error);
    await SpaceManager.addHeartbeatLog(errorMsg, 'error');
    // 网络错误或LiveKit服务器不可达时，记录错误但不中断定时任务
  }
};
