# P1 迁移与兼容说明

基准为 P0 工作区。完整文件与符号映射见 [migration-map.json](./evidence/migration-map.json)。本轮迁移 45 个完整模块，并按职责拆分 lib/std/index.ts、lib/std/device.ts、lib/ai/analysis.ts。仓库内部调用方已更新。

## 依赖边界

~~~text
app 路由/现有视图 -> features 公开业务接口 -> lib 通用能力
app/api 路由 -> server 实现 -> 可用于服务端的模型、纯函数和类型
~~~

lib/components、lib/hooks、lib/livekit 的 UI 入口标记 use client。server 下供 Next 使用的配置、网络、JWT、邮件、许可证数据库、AI、图像处理模块添加 server-only 标记。自定义 Node 入口直接加载的 server/storage/s3-clean.js 不导入该标记，因为它不在 Next 的模块环境运行；依赖扫描仍禁止客户端引用它。

静态检查解析 import、export、import type、动态 import 和 require，并解析仓库别名及相对路径。客户端运行时可达图基于 TypeScript 擦除类型后的代码，避免把纯类型误判为服务端运行时引用；lib 的业务依赖限制同时覆盖类型。动态计算路径在客户端/共享模块中必须改成可检查的显式模块映射。

检查覆盖仓库源码，不分析 node_modules 的完整传递依赖，也不代替 HTTP 响应字段审计。Next 构建的 server-only 保护和无浏览器环境的 SSR 测试提供补充验证。现有未引用的 lib/Debug.tsx 保持原状，不加入公共入口；其旧样式引用不在本轮修复范围。

## 主要迁移

| 原入口/职责 | 新入口/职责 |
|---|---|
| lib/std/index.ts | lib/utils、browser、http、components/props、types/common；业务模型在 features/room/model，网络接口读取在 server/network |
| lib/std/device.ts | lib/livekit/devices、track-types；lib/hooks/video-blur；浏览器媒体；业务设备偏好和 Socket 协议分别在 settings、room |
| lib/std/debounce.ts | lib/hooks/timing：保留原防抖/节流语义 |
| lib/ai/analysis.ts | 服务端 AI 执行在 server/ai，客户端数据类型在 features/ai/types，下载和 JSON 解析在 lib |
| lib/api/* | 各 feature 的 api.ts；现有 api 聚合对象在 features/api.ts |
| lib/store/* | room/spaces/settings/license 的状态文件；兼容聚合在 features/stores.ts |
| lib/hooks/space.ts | features/spaces/use-space-info.ts |
| lib/hooks/platform.ts | features/platform/hooks.ts；普通读取函数改名 getPlatformUserInfo，真实 hooks 保留 use 前缀 |
| lib/hooks/platformToken.ts | server/platform-token.ts；普通服务函数改名 getPlatformUserInfoServer |
| app/api/conf/conf.ts | server/config.ts；保留 JSON 配置读取与写入语义 |
| lib/email、db/license、std/blur、ai/load | server/email、db/license、media/blur、ai/prompts |
| lib/s3-clean.js | server/storage/s3-clean.js；server.js 同步引用，清理数据仍位于 lib/uploads/S3_clean.json |
| app/api/devices/device_selector.tsx | lib/livekit/device-selector.tsx；无业务依赖的列表视图在 lib/components/device-list.tsx |
| app/api/devices/screen_preview.tsx、screen_share.tsx | features/room/screen-preview.tsx、screen-track.tsx |
| app/pages/controls/widgets/pagination.tsx | lib/components/pagination.tsx 和同目录 SCSS；轨道列表类型改成泛型 |

feature 当前公开接口为其 api.ts、model.ts、types.ts、store.ts 以及本表明确列出的配置、偏好和 hooks 文件。features/api.ts、features/stores.ts 为应用现有组合入口；新业务模块优先按功能导入自己的 api/store，后续拆解逐步减少聚合入口消费者。

未建立空目录、workspace、发布包或新的设计系统。国际化和 LiveKit SDK 版本保持原有值。

## 保留的通用兼容入口

| 历史入口 | 新入口 | 应用/服务端消费者 | 移除条件 |
|---|---|---|---|
| lib/client_utils.ts | lib/utils/room-id.ts | 0 | P8 核对外部分支引用后移除 |
| lib/std/debounce.ts | lib/hooks/timing.ts | 0 | 同上 |
| lib/std/window.ts | lib/browser/window.ts | 0 | 同上 |
| lib/std/level.ts | lib/browser/performance.ts | 0 | 同上 |
| lib/types.ts | lib/livekit/connection.ts；另转导出基础类型 | 0 | 同上；移除前统一同名 types 目录入口 |
| app/pages/controls/widgets/pagination.tsx | lib/components/pagination.tsx | 0 | 同上，并清理旧分页样式 |

六个入口有导出等价测试。已经迁走的业务/服务端旧入口不在 lib 建立反向转导出，否则会重新破坏依赖边界。外部分支若仍引用 lib/api、lib/store、lib/std 等内部接口，应依据映射表迁移后合入；本轮不提供 npm 包级兼容承诺。

## 保持和明确调整的行为

- URL、API 方法和负载、Socket 事件名/负载、认证流程保持原语义。旧设备文件没有 route.ts，移动它们不改变 HTTP 路由。
- Zustand 数据形状和用户偏好 key 保持原值，包括 voce_space_user_infos、lk-user-choices；没有清空或改写用户配置。
- Dashboard 仅修改共享导入以及普通平台读取函数名称，没有拆分 Dashboard 组件。
- Next 14 的检查入口与 ESLint 9 不兼容：固定 ESLint 8.57.1，保留现有 Next 配置，不关闭规则。恢复检查后原代码的 44 个 lint 错误通过组件名称、JSX children/key、普通函数名称和条件 Hook 修正清零。
- 条件 Hook 修正涉及 BrowserSpecificInstructions、Work、ParticipantMouseEffect。特效开关子组件挂载/卸载时配对清理 observer、rAF、重试计时器和真实 handler；新增两项回归覆盖反复开关和元素尚未就绪。
- useVideoBlur 在提取时补齐待执行 rAF 清理，固定默认尺寸对象；无 ResizeObserver 时仍支持 metadata 更新。其数值计算保持原公式。

## 留给后续阶段的事项

1. P2：页面仍导出 Socket 单例和状态别名。features/spaces/use-space-info.ts 与既有业务组件仍引用该页面；这些引用已离开 lib，但连接生命周期尚未重构。
2. P2/P4：loadVideo、屏幕共享和其他媒体资源仍沿用原所有权与异步行为；不得据 P1 的局部测试宣称全应用资源清理完成。
3. P3/P4：大组件和多数视图仍在 app/pages，按原阶段继续拆解；P1 只建立依赖分层和公共 UI。
4. P6：客户端配置返回字段、录制凭据路径、环境覆盖、Redis 字符串开关和 Docker 启动仍按原计划审计。server-only 阻止代码导入，不会自动过滤接口响应。
5. P8：清理兼容入口、收敛历史 lint 警告并完成 CI 和真实浏览器/媒体验收。

回退应把本轮目录迁移、调用方导入、server.js、包清单/lockfile 和兼容入口作为同一变更集回退；不恢复用户原有的两个文档删除，不删除配置或数据卷。没有自动提交或改写历史。
