> 2026-10-11 路径更新：Web 文中的 lib 指 apps/web/lib；后端适配器归 services/api/lib。源码无根 lib 兼容层。部署模块与数据位置见 docs/monorepo-cleanup.md。

# 目录与架构边界

基于 2026-10-08 的当前代码。本文区分已经存在的结构和阶段 4 的目标结构，不能仅因规划中出现目录就假定实现完成。

## 当前落点

- `apps/web/app/`：Next App Router 页面与 HTTP 适配；页面控制器可放在相邻 `hooks/`，如 `app/dashboard/hooks/`。
- `apps/web/components/<模块>/`：模块入口、`hooks/`、`phone.tsx` / `pc.tsx`、共享视图和局部样式。房间编排位于 `components/Layout/conference/`，连接生命周期位于 `components/Room/hooks/`。
- `apps/web/lib/api/`：现有 Web API 兼容入口；新迁移的调用通过 `lib/api/client.ts` 注入浏览器 origin、部署前缀和 fetch。
- `services/api/lib/server/`：服务端组合与适配器。这里允许暂时调用现有配置及存储；不得被客户端导入。
- `apps/web/lib/store/`：Web 本地状态；`apps/web/lib/realtime/`：Web Socket 连接所有权、监听清理及服务端通知桥接。
- `packages/*/src/`：阶段 4 新提取的源码库，已通过 package.json / workspace:* 声明源码包，由消费者编译，不发布 npm。
- `services/api` 是独立 Node HTTP 入口及兼容处理器；`services/api/realtime` 注册事件，`services/api/worker` 负责对账。`apps/web/server.js` 只负责 Next/同站代理；根 `server.js` 是兼容入口，不启动 API 子进程；Next route 使用 `forwardApi`，禁止恢复业务实现和调度。SpaceManager 仍是后端兼容门面。

## 共享库依赖

| 层 | 允许依赖与职责 | 禁止内容 |
| --- | --- | --- |
| i18n | 中英俄词典、语言校验和纯翻译函数 | React、存储、浏览器/Native 全局对象、网络 |
| contracts | JSON DTO、运行时校验、协议与错误类型 | UI、媒体实例、数据库实体、密钥、平台全局对象 |
| domain | contracts、dayjs、旧共用模型/默认值/纯计算；requests 是旧接口兼容类型 | 网络、存储、React、浏览器或 Node 平台副作用 |
| client-sdk | contracts、客户端传输库、注入的 fetch / 凭证 | server-core、管理密钥、默认读取 window / localStorage、导航或媒体采集 |
| server-core | contracts、创建白名单规则、注入的存储/签发/配置端口 | NextRequest / NextResponse、页面、Web store、直接导入现有 app / lib 实现 |

Web → SDK → HTTP / Socket 适配 → server-core；RTC 媒体仍由端内连接管理器直接连接 LiveKit。配置、Redis、LiveKit 管理 SDK 等副作用放在服务端适配器。contracts 不从客户端 API 文件反向导入类型。

`pnpm check:boundaries` 检查共享库依赖白名单、平台全局引用，以及 Web 客户端到 server-core / lib/server 的传递导入。它不是全量安全审计，不证明旧 lib 模块已解除全部耦合。新增允许依赖时同时更新规则并说明原因，不以关闭检查绕过问题。

## 迁移方式

1. 先记录调用者、输入输出、权限、写入方和回退路径，再抽服务和测试。
2. 原 API 与导出保留兼容包装；逐个模块使用 SDK，禁止有副作用请求双写到新旧实现做比较。
3. 新接口执行运行时校验。兼容分支明确标识 `legacy`，不能将旧行为当作新认证方案。
4. 用户 2026-10-09 调整后，Web 已移至 apps/web，RN 骨架位于 apps/mobile；可推进 Native 工程，但真实会议与媒体验收不得用骨架或 JS 导出替代。
5. PC 和手机网页保持会议能力；原生 App 的发现、支付和导航归 App，不强制复用 Web hook，也不要求 PC 实现滑动发现。

Umami 已由用户明确后置，不作为阶段 4 的阻塞项。统计集成仍保持未完成状态，不用空实现标为完成。

当前 API 可单独运行；一个 API 部署拥有本地文件/配置/任务。根 lib 已无源码，仅保留旧清理队列数据目录；根 package.json 仅保留开发/测试依赖。Web/API 各自声明运行依赖，禁止从根补齐。启动/制品边界见 docs/monorepo-first-batch.md。

Native 可使用 contracts/domain/client-sdk、i18n、meeting-core/ui 和端内代码，不得导入 apps/web、根 lib、services 或 server-core。用户已授权 Web/App 对齐 React 19.2.0；SDK 及 React Native 平台依赖保持端内解析，不用全局 override 强制替换媒体 SDK。

## 共享 UI 小范围验证

meeting-core 仅放纯布局规则和可序列化视图数据；ui 统一包含 React/RN 基础呈现、主题、图标、控件端口和 meeting/ 会议设置组件，仅依赖 React/RN、meeting-core。2026-10-11 用户要求将原 meeting-ui 合并到 ui，不再维护独立 meeting-ui 包。两包禁止依赖 LiveKit、Web/Native 应用源码、根 lib、存储与网络。Web 显式将 react-native alias 到 react-native-web；公开类型入口不引用 RN 全局类型，组件实现以 pnpm typecheck:ui 独立验证。不要把媒体 Room 对象传入公共 UI，传入 DTO、actions 和视频渲染函数。

## Phone 设置与 i18n（2026-10-10）

Web PC 保留原设置分支；Phone 子面板通过 ui/src/meeting/settings 中的纯布局函数组合 DOM/Ant Design 端口，Native 注入 RN/Ant Design Native 端口。不得以共享为由改写已确认的 PC/Phone SCSS。草稿和媒体实例仍在端内稳定父层；纯布局函数不含 Hook，可以直接调用以保持原 DOM 层级。

所有词典以 packages/i18n/src 为唯一来源，lib/i18n 的词典文件仅为兼容导出；Web provider 与 Native provider 各自负责本机语言保存。设置 SVG 的路径/颜色/viewBox 位于 packages/ui/src/settings-icons.ts；不要用不同语义的图标或 Unicode 替代。

Native 设置快照是已确认访客会话的只读投影，仅包含自身偏好和权限矩阵；不能由 UI 接入推断房间管理、部署密钥、证书或录制授权。当前能力和验收记录见 docs/shared-room-settings.md。
