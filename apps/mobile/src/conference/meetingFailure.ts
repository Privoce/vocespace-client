import { ApiError } from '@vocespace/client-sdk';
export function meetingFailure(error: unknown) {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
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
    if (messages[error.code]) return messages[error.code];
  }
  return '连接未完成，请检查网络后重试。';
}
