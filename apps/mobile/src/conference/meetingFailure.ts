import { JoinError } from './join-error';
import { ApiError } from '@vocespace/client-sdk';
export function meetingFailure(error: unknown): string {
  if (error instanceof JoinError) {
    const stages = {
      session: '建立访客会话',
      create: '创建 Space',
      prepare: '准备加入',
      connect: '连接会议媒体服务',
      confirm: '确认入会',
      settings: '读取会议信息',
      cleanup: '清理连接',
    };
    return `${stages[error.stage]}失败：${meetingFailure(error.cause)}`;
  }
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      STORAGE_UNAVAILABLE: '服务端存储暂不可用，请检查 API 的 Redis 配置和日志。',
      INTERNAL_ERROR: '服务端处理失败，请检查 API 日志。',
      NOT_FOUND: 'API 接口不存在，请确认服务端已更新并重启。',
      INVALID_REQUEST: '请求参数无效，请检查 Space 名称和昵称。',
      CREATE_DENIED: '当前服务未开放访客创建 Space，请联系管理员调整创建策略。',
      NAME_TAKEN: '用户名已存在，请选择其他名称。',
      PRIVATE_ROOM: '该 Room 为私密房间，访客无法加入。',
      SPACE_NOT_FOUND: '没有找到这个 Space，请检查名称。',
      GUEST_DENIED: '该会议不允许访客加入。',
      SESSION_REQUIRED: '访客会话已失效，请重试。',
      RTC_NOT_CONNECTED: '会议连接尚未就绪，请重试。',
      JOIN_NO_LONGER_ALLOWED: '会议权限已变化，请重新加入。',
      JOIN_EXPIRED: '本次加入已超时，请重试。',
    };
    return `${messages[error.code] || '请求失败'}（${error.status} / ${error.code}${error.requestId ? ` / ${error.requestId}` : ''}）`;
  }
  return '连接未完成，请检查网络后重试。';
}
