import { ApiError } from '@vocespace/client-sdk';

export function mediaFailure(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'MEDIA_INVITATION_REQUIRED') return '设备邀请已失效，请让主持人重新邀请。';
    if (error.status === 401 || error.status === 403) return '会议权限已变化，请退出后重新加入。';
    return '设备授权服务暂不可用，请重试。';
  }
  if (error instanceof Error && error.message === 'SCREEN_EXTENSION_REQUIRED')
    return '请重新安装包含屏幕共享扩展的开发客户端。';
  if (error instanceof Error && error.name === 'NotFoundError')
    return '未发现可用设备。iOS 模拟器不提供真实摄像头，请在真机验证。';
  if (error instanceof Error && (error.name === 'AbortError' || error.message === 'AbortError'))
    return '采集未能启动或已取消。iOS 模拟器不支持屏幕采集，请在真机验证。';
  return '设备未能开启。请检查系统的麦克风、相机权限和设备占用，然后重试。';
}
