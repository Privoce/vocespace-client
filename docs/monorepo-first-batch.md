> 2026-10-11 后续迁移已完成根 lib 源码归属、依赖清理与独立部署配置，最新状态见 [Monorepo 收尾](monorepo-cleanup.md)。本文保留首批交付记录。

# Monorepo 首批迁移（2026-10-09）

> 2026-10-09 后续：用户已确认 Web/API 实测通过；Native 已继续接入手动观众试运行，最新行为和限制见 [当前交付](native-observer-pilot.md)。下文保留首批骨架迁移记录。

用户确认 Web、手机 App 和后端独立维护、部署。手机首版四个 Tab 为首页、会议、消息、我的，聚焦会议直播、滑动预览与延迟加入。消息/我的先保留入口与本机设置，新账号体系、私信、商业化与商店发布后置，后续接入外部用户服务。阶段进度以 [checklist](../checklist.md) 为准。

## 本批落地

- pnpm workspace：apps/web、apps/mobile、services/api，以及四个共享源码包。realtime / worker 暂为 API 的内部模块，同一部署运行，不独立扩容本地文件写入方。
- Web 的 app、components、styles、public 和 Next 配置实际迁入 apps/web；保持 Next 14 / React 18、原有布局和会议功能。根 server.js 仅兼容旧启动入口。
- Web 不再创建 API 子进程；通过 VOCESPACE_API_URL 代理 HTTP / Socket Upgrade。Next route 继续只转发。
- 修复旧 next.config.cjs 不被当前 Next 读取的问题，使用 next.config.mjs。打包脚本补齐自定义代理启动器、静态资源和 dotenv；独立制品保留同站代理，不使用会遗漏自定义代理的 Next 默认启动器。
- API 构建输出 services/api/dist/api.cjs 与 prompt 资源。构建检查禁止 UI runtime 并检查外部运行时依赖均已声明；pnpm package:api 可按共享锁文件导出生产包。
- 四个共享包通过 workspace:* 声明依赖，源码 exports 由消费者编译；未发布到 npm。
- Native 骨架采用 Expo 55 / RN 0.83 / React 19，与 Web 独立解析。首页提供会议入口，会议/消息显示当前阶段的空态，我的可修改并持久化昵称、默认静音和自动加入偏好。偏好不是身份或权限。

当前 Native **尚未连接业务 API 或 RTC**，没有假房间数据，没有实时预览或自动加入实现。JS 导出不能证明 iOS/Android 原生编译或真机通过。LiveKit/WebRTC 的版本、原生配置、权限及媒体互通留在 4.4 / 4.5 验证；本批不安装未经验证的 RTC 组合。

Expo 版本与原生基础依赖依据 [SDK 55 模板](https://github.com/expo/expo/blob/sdk-55/templates/expo-template-blank-typescript/package.json) 和 [bundledNativeModules](https://github.com/expo/expo/blob/sdk-55/packages/expo/bundledNativeModules.json) 固定，并记录到锁文件。配置遵循 [Expo monorepo 文档](https://docs.expo.dev/guides/monorepos/)。后续 LiveKit 采用 development build，不能用 Expo Go 验证其原生媒体能力，见 [LiveKit Expo 文档](https://docs.livekit.io/transport/sdk-platforms/expo/)。

## 开发命令

从仓库根目录操作，使用 .nvmrc 中的 Node 24.12.0 和 pnpm 10.27.0：

```sh
nvm use
pnpm install --frozen-lockfile
# 终端一：独立 API / Socket / worker
pnpm dev:api
# 终端二：Web，默认代理 http://127.0.0.1:3001
pnpm dev:web
# 终端三：已安装 development build 的原生设备
pnpm dev:mobile
```

首次安装原生开发构建使用 `pnpm --filter @vocespace/mobile ios` 或 `android`，分别需要 Xcode / Android 工具链。本批没有执行原生生成、签名或设备安装。应用 ID `com.vocespace.mobile.dev` 仅为开发标识，发布前另行确定。

根 `pnpm dev` / `pnpm start` 现在只运行 Web。运行中的旧进程不会自动切换目录或启动逻辑，下一次开发/部署需按新命令分别启动。没有重启用户原服务。

## 配置和数据

Web 可使用 apps/web/.env.local；迁移期也读取根 .env.local，子项目优先，进程环境优先于文件。独立 Web 制品不复制这些文件，也不需要数据库或 LiveKit 管理密钥；打包静态资源时排除本机生成且被 gitignore 忽略的 public/license。

API 通过 start.mjs 启动：显式设置 VOCESPACE_DATA_DIR 时，只从该目录读取环境文件，再在业务模块加载前切换 cwd。未指定时，工作区先读取 services/api 和根目录的环境文件，默认沿用仓库根作为数据目录。独立部署应明确指定**已存在的绝对数据路径**。

保留的数据相对路径为 vocespace.conf.json、uploads/、sql/、lib/uploads/S3_clean.json；不搬迁、不重置、不并发创建第二套。一个 API 进程拥有这些写入；worker 与其共用。VOCESPACE_PROMPT_DIR 默认指向 API 制品 dist/prompt，配置和提示词资源分离。

需要独立设置 API_HOST / API_PORT、PUBLIC_ORIGIN、PLATFORM_JWT_SECRET 等后端环境。Web 的 VOCESPACE_API_URL 是服务间地址，浏览器继续同站请求。真实 LiveKit 地址仍必须让客户端可达，不能以 API 内网地址替代。Native 的直连 HTTPS、Bearer 会话与安全存储尚待实现。

## 独立制品

```sh
pnpm build:web
# 整个 apps/web/.next/standalone 是 Web 制品，可复制到另一目录/机器
# 在制品根目录运行，API 地址由部署环境提供
NODE_ENV=production HOST=0.0.0.0 VOCESPACE_API_URL=https://api.example.com node server.js

pnpm build:api
# 使用空目录作为导出目的地
pnpm package:api /tmp/vocespace-api-release
# 在 API 制品目录运行，数据目录提前准备/挂载
NODE_ENV=production API_HOST=0.0.0.0 VOCESPACE_DATA_DIR=/srv/vocespace-data node start.mjs
```

package:api 仅在导出命令启用 pnpm 的共享锁文件部署选项，不改变开发工作区的源码链接；API 的共享源码已编译进 bundle。本批发现 --legacy 导出会混入根 Web 依赖，已改用上述经过隔离检查的路径。

示例域名需替换为实际配置。独立制品需要目标平台兼容的 Node 和 native dependencies；跨平台镜像/amd64/arm64 尚未验证。现有根 Dockerfile / docker-compose / entrypoint 是旧一体化方案，尚未适配此次迁移，新的镜像、compose 和安装技能属于 4.6。

## 尚存的迁移边界

根 lib 保留旧 Web 工具、旧 DTO、后端适配器等兼容代码，根 runtime 依赖因此尚未全部移除。Web 的 @/lib/* 暂时指向这里；API 构建会打包所需后端实现。它不是可供 Native 导入的共享包，边界检查禁止 Native 导入根 lib、Web 或服务端。后续需继续将旧类型/纯规则与平台适配器分开，不能将本批目录迁移当作这项完成。

所有 Web 路由和原生媒体验收仍需真实服务回归。现有平台会话/管理权限保留，暂缓新用户体系不等于取消服务端授权。

## 验证记录

见 checklist 勾选；本批验证包括 workspace 冻结锁文件、Web/API 构建、类型与边界、59 项测试，以及隔离的 28 项生产 Web 代理 / HTTP / Redis / Socket 检查。Native 已完成类型检查与 iOS/Android JS 导出；没有进行原生编译或真机测试。CI 已更新，未推送触发远程运行。
