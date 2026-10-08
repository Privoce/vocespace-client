# 开发与验收规范

## 工具与代码风格

沿用 `pnpm-lock.yaml` 和 pnpm。现有栈为 Next 14、React 18、TypeScript、Ant Design、LiveKit、Socket.IO；具体版本以 package.json / lockfile 为准，不顺带升级框架。格式遵循 `.prettierrc`（两空格、单引号、分号、尾逗号、100 列）。只格式化本次相关文件。

根命令：`pnpm dev` / `pnpm start` 只启动 Web，后端使用 `pnpm dev:api` / `pnpm start:api` 独立启动；Web 不再自动创建 API 子进程。不要在已有服务占用的端口或构建目录上重复启动破坏用户会话。

## 必需检查

- `pnpm check:boundaries`：新共享库及客户端/服务端导入边界。
- `pnpm typecheck`：全项目 TypeScript。
- `pnpm test`：Vitest；服务/契约/SDK 测试使用 node 环境，Web UI 测试使用 jsdom。
- `pnpm --filter @vocespace/web exec next lint --dir <改动目录>`：针对相关模块；生产验证使用标准 `pnpm build`，不能以关闭 lint 或类型检查代替修复。
- `git diff --check`：空白错误。根据变更运行真实服务、浏览器、真机检查，自动测试不能代替媒体互通。

迁移测试应验证边界和行为：契约坏输入、旧格式兼容、鉴权拒绝、错误传播、取消/竞态、资源清理及存储幂等。不要只断言实现内部调用顺序，也不要为纯文案改动新增无意义测试。测试使用隔离依赖和假凭证，不连接用户 Redis、不签发真实服务令牌或触发外部邮件/交易。

## 状态记录

`checklist.md` 是实施状态；架构方案和验收证据放 `docs/`。勾选需要明确证据，区分代码完成、自动验证、真实服务/真机回归和用户确认。用户已于 2026-10-08 确认前期回归完成，但未提供逐项日志；不能据此宣称新服务迁移或未来 App 也已通过回归。

本次发现原清单引用的 docs 和 34 项测试在当前 checkout 不存在。历史数字保留为历史记录；当前测试数量与结果重新记录，不能继续引用旧结果作为新代码验证。

提交说明包含改动、原因、检查结果及剩余范围。未请求时不代用户提交/推送代码，不将未做的上线或真实设备验证写成已完成。

## 4.2 新增验证

- `pnpm build:api` 生成不依赖 Next/UI 的 `services/api/dist/api.cjs`；`pnpm build` 同时构建 API 和 Web。
- `pnpm test:backend` 需要本地 redis-server，自动创建临时 Redis/API/本地媒体响应模拟，使用随机端口，结束清理；不能改成连接用户 Redis。
- 设置 `WEB_BUILD_DIR` 可对已构建的隔离 Web 副本验证同站代理和 WebSocket Upgrade；不覆盖已有运行中构建目录。
- 当前 59 项单元/Hook 测试及 28 项集成检查不是实际 LiveKit 媒体、S3/AI/平台或手机真机验收。远程 CI 是否运行单独记录。

## Native 工具链

统一开发 Node 版本见 .nvmrc；mobile 有独立 React/TS 版本，使用 pnpm typecheck:mobile。根 typecheck 不包含 Native UI；CI 另行检查 mobile。Expo export 只验证 JS 打包，不代表 iOS/Android 原生编译、模拟器或真机通过；LiveKit/WebRTC 需 development build。检查新增 API 外部 runtime 依赖声明，独立构建不能依赖根 node_modules 偶然补齐。

隔离 Next 构建必须在副本中独立安装依赖（可用 pnpm 离线缓存），不能把整个 node_modules 软链接到工作区。Next standalone 追踪与清理可能沿这些目录链接影响源码；制品 node_modules 必须解析在制品目录内。验证失败后先检查并恢复工作区，再继续。
