# VoceSpace lib 封装与组件拆解设计

更新日期：2026-09-15。本文对应 [plan.md](./plan.md) 的 P1–P4，以 [checklist.md](./checklist.md) 追踪执行状态。P1 已实现 lib 分层和公共入口，见 [P1 完成报告](./docs/p1/README.md) 与 [迁移表](./docs/p1/migration.md)；其余章节仍描述 P2–P4 目标。

## 1. 范围与设计原则

目标是仓库内复用和可维护性，不发布 npm SDK，不建立 workspace。拆解 Dashboard 以外的应用模块；Dashboard 保留原目录和结构，只迁移共享引用、必要调用及类型，做兼容冒烟。

保留 Next.js App Router、React、Ant Design、LiveKit、Socket.IO 和 Zustand 的当前技术路线。默认不改变 URL、认证、平台直入、通信协议、持久化格式、主要布局和中英俄语言支持。

根据责任拆解，不根据行数拆碎。组件超过约 300 行时检查是否混合职责，行数不作为强制验收阈值。复用已有 controls hooks，不重新发明已完成的抽离。

## 2. 目标目录

~~~text
app/
  路由页面、layout、API route 入口
  dashboard/       保留现有结构，只做必要兼容修改

features/
  room/            入会、会话、连接、离会
  controls/        控制栏与业务动作
  participants/    成员、轨道展示、成员操作
  chat/            聊天、附件、未读
  channels/        频道与频道切换
  settings/        设置与持久化
  recording/       录制状态与页面
  spaces/          空间创建
  avatars/         虚拟形象、特效、模糊
  ai/              AI 任务、采集与报告
  apps/            计时、待办等应用工具
  platform/        平台用户与直入适配

lib/
  components/      通用 UI
  hooks/           通用 React hooks
  utils/           纯函数
  browser/         浏览器能力封装
  livekit/         不含产品策略的 LiveKit 适配
  http/            请求基础能力
  analytics/       统计传输适配
  types/           跨模块基础类型
  i18n/            国际化基础设施

server/
  配置、Redis、存储、Socket.IO 与服务端业务支持

styles/
  全局主题和真正跨模块的样式；业务样式逐步随 feature 组织
~~~

目录按实际迁移创建，不生成空目录。feature 可包含 components、hooks、services、model、types 及公开入口，但不强制每个 feature 都具备这些子目录。

## 3. 依赖方向与边界

~~~text
路由页面 → features → lib
API 路由 → server → 服务端可用的纯工具 / 类型
~~~

| 层 | 允许依赖 | 禁止依赖 |
|---|---|---|
| lib/utils | 纯工具、基础类型 | React、Ant Design、LiveKit、DOM、网络、业务 store |
| lib/browser | 纯工具、浏览器 API | 路由页面、业务权限和账号状态 |
| lib/hooks | React、通用工具、浏览器适配 | 业务 store、空间 API、产品事件 |
| lib/components | React、Ant Design、通用 hooks、样式 | 路由导航、业务请求、Socket 实例、产品 store |
| lib/livekit | LiveKit SDK、通用 hooks/工具 | 平台账号、空间权限、许可证、具体 API |
| lib/http | fetch 基础能力、请求类型 | 特定 feature 状态、路由跳转 |
| lib/analytics | 传输、加载、过滤接口 | 产品事件目录、空间或账号身份 |
| features | 自身模块、lib、其他 feature 公开入口 | 页面导出、其他 feature 私有文件、服务端凭据 |
| server | 服务端依赖、纯工具与类型 | 客户端 UI、React 会话上下文 |

- lib 不依赖 app 或 features，不保留产品 store。
- 业务 hooks 留在 feature；名称以 use 开头不等于通用。
- 跨 feature 的双向耦合通过上层组合、接口注入或提取共同基础类型解决。
- 类型专用依赖使用 type import，避免无意引入运行时代码。
- 客户端和服务端入口分开；服务端模块不进入客户端 barrel export。
- 不建立导出全部能力的 lib/index.ts。各目录只导出稳定公共接口。
- 迁移期旧路径可转导出，但必须记录消费者和移除条件，不成为新代码依赖入口。
- server.js 仍由 Node 直接运行；迁移配置与存储工具时保留 Node 可执行的 ESM 入口，不引入无法直接运行的 TS 或仅由 Next.js 解析的路径别名。

P1-05 已通过 pnpm check:boundaries 检查：lib 不依赖 app/features/server，纯工具不依赖 DOM/React/网络，客户端运行时图不引用服务端实现。边界反例、SSR 导入和六个旧入口等价测试已接入。当前业务层仍有 PageClientImpl 引用，P2 继续收敛。

## 4. 公共接口设计

### 4.1 通用组件

通用组件只负责显示和交互，输入为明确的 props、回调与 children，保留必要的 className、样式、键盘和可访问性属性。

例如，通用选择器接收 options、value、onChange；设备选择业务负责发现设备、切换设备与错误提示。公共 UI 不自行请求权限、创建 Socket、导航、读取业务 store 或发送产品埋点。

已有 Ant Design 依赖可以保留，本轮不另建完整设计系统。通用样式随组件组织，业务样式随 feature 迁移，全局主题保留单一入口，避免重复引入 LiveKit 全局样式。

### 4.2 通用 hooks 和函数

只提取已有实际复用或明确的资源边界，不为未来可能使用创建抽象。优先盘点：

| 能力 | 归属 | 接口与责任 |
|---|---|---|
| 尺寸观察 | lib/hooks | 接收目标，返回尺寸，释放 ResizeObserver |
| 媒体查询 | lib/hooks | 接收查询条件，提供 SSR 初始值，清理监听 |
| 防抖 | lib/utils 或 lib/hooks | 纯调度与 React 生命周期分开，支持取消 |
| 事件订阅 | lib/hooks / lib/livekit | 接收目标、事件、handler；仅清理自身订阅 |
| 浏览器存储 | lib/browser / lib/hooks | 提供解析、缺失和异常处理，由业务指定 key/迁移策略 |
| 设备与媒体适配 | lib/livekit | 包装实际 SDK 能力，业务权限和 UI 策略由 feature 决定 |
| HTTP 基础能力 | lib/http | 处理传输、取消、统一错误边界，不携带业务重定向 |

每个订阅型 hook 必须说明目标变化、handler 生命周期、清理函数、异步取消或过期结果处理，以及 SSR 行为。浏览器全局对象不在导入阶段访问。

### 4.3 业务公开入口

feature 公开组件、业务 hook、必要类型和操作接口，不导出内部计时器、可变全局对象或所有 store 实现。公共入口区分客户端与服务端用途。

短期保持 API 响应和 Socket payload 兼容，不顺带统一全部网络接口。网络适配与消费者在同一迁移任务内验证。

### 4.4 统计接口边界

事件名称、业务属性枚举和触发时机由业务层维护。lib/analytics 实现配置、脚本加载、发送前处理和传输适配；业务层通过类型化 trackEvent() 调用。公共组件只提供行为回调，不内嵌 VoceSpace 产品事件。

## 5. 状态与生命周期

### 5.1 状态所有权

| 状态 | 所有者 | 持久化 / 清理 |
|---|---|---|
| 轨道、连接、参与者 | LiveKit，feature 派生视图状态 | 遵循 Room 生命周期 |
| 入会、离会、重连阶段 | room feature | 会话结束清理 |
| 用户偏好 | settings / 用户偏好模块 | 保留当前存储 key 和格式 |
| 消息和未读 | chat feature | 按会话/频道重置，兼容服务端历史 |
| 当前频道与列表 | channels feature | 切换时处理过期结果 |
| 面板开关 | 最近组件或 feature | 不无条件持久化 |
| 管理权限与许可证 | 对应业务策略模块 | 保持当前认证和权限语义 |

同一事实不同时存于组件 state、Zustand 和 LiveKit。派生值尽量由原始状态计算。持久化格式如确需升级，显式处理旧版本，不清空用户所有偏好作为迁移手段。

### 5.2 Socket 与房间

- Socket 由会话 Provider 在客户端生命周期内创建，禁止模块导入时自动连接。
- LiveKit Room 与 Socket 分别管理连接状态，不把 Socket 已连接当作媒体已连接。
- 先登记现有事件名、payload、发送方、监听方和退出条件，再迁移实现；协议基线已由 P0-04 完成，见 [protocol.md](./docs/p0/protocol.md)。
- 子组件只移除自己注册的事件和 handler，不调用全局清空监听。
- 会话退出时断开本会话拥有的连接并释放订阅；重入创建或恢复合法的新会话，不复用已失效上下文。
- 离会、切房间和再次入会清理会话状态，保留用户偏好。
- 重连不重复触发创建、发送、录制等已有业务动作。
- 取消或忽略旧请求的结果，防止前一房间响应覆盖当前房间。
- 新模块验证重复挂载和清理，不将全局开启 Strict Mode 绑定为本次重构要求。

### 5.3 媒体和后台任务

虚拟形象、模糊、共享和 AI 采集分别声明输入轨道、派生轨道及释放责任，只停止自己创建或拥有的资源。关闭一个面板不得误停 LiveKit 或其他消费者共享的媒体。

卸载时清理动画帧、定时器、观察器、订阅、派生流、图形渲染器和由本模块创建的临时对象 URL。AI 请求和采集任务具有取消或结果过期机制，不在离会后更新 UI 或重复启动。

## 6. 组件拆解与迁移对照

| 当前模块 | 目标 feature | 拆解后的职责 | 对应任务 |
|---|---|---|---|
| app/[spaceName]/PageClientImpl.tsx | room、platform | 参数适配、预览/会话切换；配置、入会、连接、退出下沉 | P2-01–04、P3-06 |
| app/pages/controls/video_container.tsx | room、participants | 视频布局视图、布局状态、焦点轨道、分页和扩展面板组合 | P3-01 |
| app/pages/controls/bar.tsx | controls | 工具条视图、设备控制、聊天/设置入口和离会动作 | P3-02 |
| app/pages/participant/tile.tsx | participants | 轨道显示、覆盖信息、连接状态和菜单组合 | P3-03 |
| app/pages/participant/player.tsx | participants | 播放绑定、媒体输出与清理，移除成员管理与应用联动 | P3-03 |
| app/pages/participant/menu.tsx | participants | 菜单视图、权限判断和成员操作 | P3-03 |
| app/pages/chat/ | chat | 消息列表、输入器、附件、预览、消息状态与订阅 | P3-04 |
| app/pages/controls/channel.tsx | channels | 列表、频道视图、切换和管理操作 | P3-05 |
| app/pages/pre_join/ | room | 表单、设备预览、设备选择和提交状态 | P3-06 |
| app/pages/virtual_role/、blur/、participant 特效 | avatars | 资源加载、渲染控制、媒体管线和配置面板 | P4-01 |
| lib/ai/ 和 AI 相关 UI | ai | 采集、调度、任务状态、结果展示 | P4-02 |
| app/pages/apps/ | apps | 应用入口、各工具业务状态和视图 | P4-03 |
| app/pages/controls/settings/ | settings | 表单、设备测试、持久化与权限 | P4-04 |
| app/new_space/、app/recording/ | spaces、recording | 业务表单/列表/状态，路由保留组合 | P4-05 |
| app/api/devices/ | lib/livekit、相关 feature | 通用设备适配与业务设备 UI 分离 | P1-03 |
| lib/std/、lib/api/、lib/store/、lib/hooks/ | lib、对应 feature、server | 按纯能力、浏览器能力、业务和服务端分类迁移 | P1-02、P1-04 |

视频布局、控制栏和成员组件通过公开 props/回调或会话上下文协作，不重新形成一个导出所有状态的巨型入口。共享能力先提取，再迁移业务消费者。

## 7. 迁移策略和兼容性

每个模块遵循以下顺序：

1. 登记当前输入、输出、状态、订阅、资源和关键交互。
2. 提取纯函数、基础类型和已有重复逻辑。
3. 抽离连接、请求、权限与资源管理。
4. 提取视图组件，保持行为。
5. 旧入口提供短期转导出，逐个迁移调用方。
6. 执行模块行为及相关会议回归。
7. 引用扫描确认无消费者后删除旧入口。

每个 PR 聚焦一个责任迁移，避免同时改变 UI、业务行为和通信协议。不覆盖用户已有未提交修改。

### 7.1 默认保持

- 当前 URL、平台直入参数、认证与权限语义。
- API 请求语义、Socket 事件名与负载。
- 用户偏好 key、格式与当前版本兼容。
- LiveKit 客户端版本；依赖升级单独评估。
- 中英俄语言和主要视觉布局。

### 7.2 明确接口调整

新增 feature 公共入口、会话 Provider、通用组件与 hooks、类型化埋点接口，以及部署健康检查。

现有配置类型和录制配置路径涉及服务端凭据。P6-01 将客户端返回值收窄为所需能力与非敏感字段，同时迁移调用方；这是明确记录的接口调整，不通过保持兼容继续返回密钥。管理配置读取和普通客户端读取应分离。

### 7.3 迁移记录模板

| 原入口 | 新入口 | 公开接口 / 类型 | 消费者 | 兼容方式 | 验证 | 移除条件 / PR |
|---|---|---|---|---|---|---|
| 待迁移模块 | 待填写 | 待填写 | 待填写 | 转导出或同步替换 | 待填写 | 无引用且回归通过 |

### 7.4 回退原则

迁移提交按模块保持可审查、可回退。未通过回归不移除旧入口；回退时连同消费者和对应导出一起恢复，避免混合新旧接口。不使用破坏用户工作区的整体重置。配置/数据升级的备份恢复流程见 plan.md 的 P6/P8。

## 8. 测试与验收

计划采用 Vitest、React Testing Library 验证纯逻辑、hooks、组件及订阅生命周期；Playwright 验证页面流程；真实双端 LiveKit 通话验证媒体链路。P0 已配置 Vitest、React Testing Library 与 pnpm test；P1 扩充到 46 项测试并通过 Node 24 验证，见 [P1 完成报告](./docs/p1/README.md)。Playwright 与真实双端回归尚未实施。

### 8.1 工程验证

- 类型检查、lint、生产 build；P0 先记录已有失败，后续不得新增问题。
- 依赖边界扫描：lib 不反向引用页面/feature，客户端入口不导出服务端模块。
- SSR 导入不访问 window、document、localStorage，不在导入时创建连接。
- 纯函数测试验证真实行为；不为简单文件移动编写镜像实现的测试。
- hooks 测试验证目标变化、重复挂载、清理和过期任务。

### 8.2 业务验证

| 场景 | 核心断言 |
|---|---|
| 普通入会、平台直入 | 参数、认证、设备偏好和连接流程兼容 |
| 权限拒绝、设备缺失 | 错误可恢复，不残留连接和采集 |
| token/连接失败、重连 | 状态正确、重试可用、无重复业务动作 |
| 离会重入、导航、刷新 | 旧状态不污染新会话，资源释放 |
| 音视频与设备切换 | 两端可听可见，切换不泄露旧轨道 |
| 共享开始/停止 | 状态与实际发布一致，退出后停止 |
| 消息、附件、未读 | 保持提交语义，重连不重复处理 |
| 成员和频道 | 权限、菜单、切换与失败处理一致 |
| 虚拟形象与特效 | 反复启停无资源累积，不误停共享输入 |
| AI | 取消、失败、过期结果和正常完成可验证 |
| 录制 | 未配置明确，失败可见，状态与文件可用性分别验证 |
| Dashboard | 共享接口迁移后原有功能冒烟通过 |

浏览器矩阵覆盖桌面 Chromium、Firefox、Safari，以及项目已有支持范围内的移动端。受限制或主动拦截的浏览器保持原有提示行为，不通过重构擅自扩大支持承诺。缺少设备的验证明确标记未执行。

### 8.3 完成标准

- [ ] Dashboard 以外纳入范围的模块完成责任拆解。
- [ ] 通用层不存在对路由页面或产品 store 的反向依赖。
- [ ] 房间、Socket 与媒体资源所有权清晰，清理有验证。
- [ ] 旧入口已迁移或有明确保留理由、消费者和后续任务。
- [ ] 核心行为测试及真实双端回归通过。
- [ ] 构建、类型和 lint 无本轮新增问题。
- [ ] Dashboard 必要兼容回归通过。
- [ ] 公共接口、迁移记录、验证证据和实际工时同步到三份文档。
