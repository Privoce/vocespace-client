# 目录与架构边界

基于 2026-10-08 的当前代码。本文区分已经存在的结构和阶段 4 的目标结构，不能仅因规划中出现目录就假定实现完成。

## 当前落点

- `apps/web/app/`：Next App Router 页面与 HTTP 适配；页面控制器可放在相邻 `hooks/`，如 `app/dashboard/hooks/`。
- `apps/web/components/<模块>/`：模块入口、`hooks/`、`phone.tsx` / `pc.tsx`、共享视图和局部样式。房间编排位于 `components/Layout/conference/`，连接生命周期位于 `components/Room/hooks/`。
- `lib/api/`：现有 Web API 兼容入口；新迁移的调用通过 `lib/api/client.ts` 注入浏览器 origin、部署前缀和 fetch。
- `lib/server/`：服务端组合与适配器。这里允许暂时调用现有配置及存储；不得被客户端导入。
- `lib/store/`：Web 本地状态；`lib/realtime/`：Web Socket 连接所有权、监听清理及服务端通知桥接。
- `packages/*/src/`：阶段 4 新提取的源码库，已通过 package.json / workspace:* 声明源码包，由消费者编译，不发布 npm。
- `services/api` 是独立 Node HTTP 入口及兼容处理器；`services/realtime` 注册事件，`services/worker` 负责对账。`apps/web/server.js` 只负责 Next/同站代理；根 `server.js` 是兼容入口，不启动 API 子进程；Next route 使用 `forwardApi`，禁止恢复业务实现和调度。SpaceManager 仍是后端兼容门面。

## 共享库依赖

| 层 | 允许依赖与职责 | 禁止内容 |
| --- | --- | --- |
| contracts | JSON DTO、运行时校验、协议与错误类型 | UI、媒体实例、数据库实体、密钥、平台全局对象 |
| domain | contracts、纯规则与状态转换 | 网络、存储、React、浏览器或 Node 平台副作用 |
| client-sdk | contracts、客户端传输库、注入的 fetch / 凭证 | server-core、管理密钥、默认读取 window / localStorage、导航或媒体采集 |
| server-core | contracts、domain、注入的存储/签发/配置端口 | NextRequest / NextResponse、页面、Web store、直接导入现有 app / lib 实现 |

Web → SDK → HTTP / Socket 适配 → server-core；RTC 媒体仍由端内连接管理器直接连接 LiveKit。配置、Redis、LiveKit 管理 SDK 等副作用放在服务端适配器。contracts 不从客户端 API 文件反向导入类型。

`pnpm check:boundaries` 检查共享库依赖白名单、平台全局引用，以及 Web 客户端到 server-core / lib/server 的传递导入。它不是全量安全审计，不证明旧 lib 模块已解除全部耦合。新增允许依赖时同时更新规则并说明原因，不以关闭检查绕过问题。

## 迁移方式

1. 先记录调用者、输入输出、权限、写入方和回退路径，再抽服务和测试。
2. 原 API 与导出保留兼容包装；逐个模块使用 SDK，禁止有副作用请求双写到新旧实现做比较。
3. 新接口执行运行时校验。兼容分支明确标识 `legacy`，不能将旧行为当作新认证方案。
4. 用户 2026-10-09 调整后，Web 已移至 apps/web，RN 骨架位于 apps/mobile；可推进 Native 工程，但真实会议与媒体验收不得用骨架或 JS 导出替代。
5. PC 和手机网页保持会议能力；原生 App 的发现、支付和导航归 App，不强制复用 Web hook，也不要求 PC 实现滑动发现。

Umami 已由用户明确后置，不作为阶段 4 的阻塞项。统计集成仍保持未完成状态，不用空实现标为完成。

当前 API 可单独运行；一个 API 部署拥有本地文件/配置/任务。根 lib 暂保留旧兼容实现与根依赖，逐步拆出，不允许新 Native 模块引用。启动/制品边界见 docs/monorepo-first-batch.md。

Native 仅使用 contracts/domain/client-sdk 和端内代码，不得导入 apps/web、根 lib、services 或 server-core。Web React 18 与 Native React 19 各自解析，不能在 workspace 根强制覆盖为同一版本。
