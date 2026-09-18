# 阶段 1 验证记录

## 已完成

- 改动前与改动后的 TypeScript 检查：`pnpm exec tsc --noEmit --incremental false`。
- 自动化：`pnpm test`，8 个测试文件、23 个用例通过。覆盖普通/加密/邀请链接、登录参数清理、权限失败与提示关闭、无 Permissions API 的授权状态、重复提交、预加入卸载后的异步结果、布局状态保持、Room/worker 生命周期和显式退出。
- 新增模块 lint：`pnpm exec next lint --dir features --dir lib/realtime --file app/DeviceLayoutSync.tsx --file lib/hooks/use-layout-device.ts --file lib/hooks/use-socket-session.ts`，无警告或错误。
- 生产打包：`pnpm exec next build --no-lint`。该参数仅用于将打包验证与现有全量 lint 问题分开，不改变项目配置。
- 浏览器检查：375×812、393×852 手机预加入页和 1280×900 PC 布局；首页创建/房间名切换、路由跳转、权限提示关闭、底部加入按钮、姓名跨布局保留。未授权真实摄像头或麦克风。

## 已知限制

- 标准 `pnpm build` 仍受原有全量 lint 错误阻断，包括未改动业务中的 hooks 调用规则、缺失 displayName，以及 `lib/std/index.ts` 对不存在的 ESLint 规则的引用。本阶段未关闭这些规则，也未扩展为全站 lint 修复。
- 打包收集页面数据时，现有 Redis 模块尝试连接本机 6379，沙箱阻止连接后有日志；本次生产打包仍成功退出。安装与服务启动链路在阶段 4 整理。
- 单元测试使用模拟媒体和连接对象；不能代替真实设备、浏览器和 LiveKit 服务的互通验收。
- 当前提供统一布局 hook 和旧 store 桥接。房间内部剩余 UA/宽度分支随阶段 2 的 Phone/PC 拆分逐个替换；浏览器能力判断保留独立语义。

## 真机/真实服务验收清单

- [ ] iOS Safari 与 Android Chrome：授权、拒绝授权、无摄像头、选择不同设备、软键盘打开后加入按钮可达。
- [ ] 两端加入普通空间及 E2EE 空间，验证音视频正常；退出后采集和连接停止。
- [ ] 已连接时改变窗口尺寸，不重新加入房间；短暂断网后恢复，不主动删除成员。
- [ ] 平台登录、平台直入、邀请链接与访客禁止策略端到端验证。
- [ ] 房间与管理后台的 Socket.IO 通知，以及服务端 re_init_response 广播联调。

## 结构说明

参见 [页面与会话结构](page-architecture.md)。所有更改均保留在当前工作区，未提交或部署。
# 阶段 2 补充

阶段 1 记录中的全量 lint 阻断已在阶段 2 修复。当前标准 `next build`（含 lint）通过；真实服务与真机验收仍待用户统一回归。阶段 1 下方内容保留为当时的验证记录，最新结果见 `stage-2-verification.md`。
