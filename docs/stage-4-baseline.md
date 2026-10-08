> 后续状态：4.2 已完成代码与自动验证。本文是迁移前盘点，当前结构、授权与遗留范围见 [4.2 交付说明](stage-4-b2.md)。

# 阶段 4：当前代码盘点与迁移边界

日期：2026-10-08。依据当前 checkout 的实际代码，而非旧目录规划。用户确认阶段 1、2 回归完成；Umami 延后，不再作为阶段 4 前置条件。该确认不替代后续每次服务迁移的回归。


第二批更新：基础 Space repository、入房直接查存储、部分配置授权及公开凭证清理已落地，见 [第二批记录](stage-4-batch-2.md)。下文为首批盘点快照；其中 SpaceManager 的当前位置和本轮已修复问题以第二批记录为准。
## 本次范围与现状

本次启动 B0，并交付 B1 的第一条纵向迁移链路：入房契约 → domain 规则 → 服务端口 → Next 适配，以及 SDK → 现有 Web 入房/聊天历史/退出调用。未创建正式 RN 项目、独立部署 API、发现流或商业系统。B0 的完整授权矩阵与身份协议、B1 剩余服务仍待完成，不能把本批交付等同于阶段 4 全部完成。

当前目录已由旧 `features/` 移到 `components/*/hooks`、`components/Layout/conference`、`app/dashboard/hooks` 等；旧清单引用的 `docs/page-architecture.md`、阶段 1/2 验收记录和旧 34 项测试在当前 checkout 不存在。历史结果保留，但本批重新建立测试与验证记录。

现有栈：Next 14.2.35、React 18.3.1、Ant Design 6、TypeScript、Zustand、LiveKit client 2.9.3 / server SDK 2.10.1、Socket.IO 4、Express 5、ioredis。具体依赖由 lockfile 锁定。根 `server.js` 同时启动 Next / Express、Socket、静态上传服务、心跳触发及清理任务；不是纯前端服务器。

## HTTP 入口清单

下表覆盖当前 16 个 route 文件。授权栏是迁移关注点，不代表已完成所有分支的安全审计；完整动作级授权矩阵在下一批补齐。输入、响应和副作用以对应 route 与 lib/api 为基线，不先统一改写旧状态码。

| 接口 | 方法 / 主要输入与输出 | 当前调用者、副作用与目标归属 |
| --- | --- | --- |
| `/api/connection-details` | GET：spaceName/participantName/identity/metadata/auth/token；连接 DTO 或平台重定向；POST：平台 payload → token | Web 加入、外部平台；创建策略、媒体签发。普通路径已抽 legacy service；可信身份验证仍待迁移 |
| `/api/space` | GET/POST/PUT/DELETE：query 动作 + JSON body；空间、成员、子房间、应用、聊天历史、在线/历史统计 | lib/api/space、channel、chat、record、后台及 server.js；Redis、LiveKit、平台同步、事件通知；拆 Space/成员/权限/历史 repository 与服务 |
| `/api/conf` | GET：可读配置/初始化状态；POST：setup/check/create_space/AI/SMTP/RTC 等配置 | 首页、设置、后台；配置文件写入和进程内快照；隔离公开配置与管理员配置命令，逐动作审计 hostToken 校验 |
| `/api/chat` | POST url → 链接预览 / 错误 | 聊天 UI；服务端远程抓取；链接预览服务与外部访问控制 |
| `/api/upload` | POST JSON/FormData、OPTIONS；文件、播放器/白板/Hyperbeam 管理、删除与下载 | 聊天、TilePlayer；uploads 文件及第三方会话；文件服务需统一路径/成员/所有权授权 |
| `/api/files/[...slug]` | GET：房间/文件路径 → 文件流与范围响应 | 播放/下载；本地文件读取；文件适配器，验证与 `/uploads` 静态入口一致的访问策略 |
| `/api/record` | GET env；POST spaceName/type/egressId → 录制状态 | 控制栏、录制页；LiveKit Egress、S3 清理任务；录制服务与 worker |
| `/api/s3` | GET/POST/DELETE：录制对象查询、下载资格、删除 | lib/api/s3、录制/后台；S3 列表/签名/删除；对象存储适配器，需绑定权限范围 |
| `/api/ai` | GET/POST：action/spaceName/userId/分析数据 → AI 结果或平台数据 | AI/工作模式；模型、平台调用和分析处理；AI 服务，不能信任客户端 isAuth |
| `/api/feedback` | POST：反馈与附件 → 提交结果 | Channel 反馈；uploads/feedback 与邮件；反馈服务及限流 |
| `/api/license` | GET/POST/PUT/PATCH/DELETE：许可查询/生成/更新/校验/删除 | 后台、房间授权；本地 JSON 许可存储、邮件；保留 hostToken 管理分支并审计各动作 |
| `/api/license/[value]` | GET value → 许可结果 | 许可客户端；许可查询服务 |
| `/api/license/domains/[value]` | GET value → 域名许可结果 | 许可客户端；许可查询服务 |
| `/api/webhook` | GET/DELETE：购买/取消；POST：Stripe 回调 | 购买流程与 Stripe；支付、许可文件、配置及邮件；现有 Web 商业服务，不能当作 App 商店支付实现 |
| `/api/webhook/status` | GET → webhook 开关 | 前端能力检查；公开能力配置 |
| `/api/hello` | GET → 示例响应 | 示例路由，迁移时评估移除，不作为服务健康检查依据 |

`app/api/devices/*.tsx` 是设备 UI，虽在 api 目录下并不是 HTTP route；B3 目录迁移时应归入 Web UI。

`/api/space` 动作包括 all/detail、spaceName/pre、timeRecord、chat/history、space=create、heartbeat/日志/清理记录，POST 的 childRoom/nameCheck/record/ownerId/participant/apps/persistence/update/allowGuest/iframe/transfer/mode/enter，以及 PUT/DELETE 的 childRoom/status/socketId/participant/delete/flushdb。不能只按四个 HTTP 方法估算迁移规模。

## Socket 事件与任务

当前没有统一的握手会话鉴权，多个事件全局广播或直接使用客户端 socketId。`socket.auth` 可注入只是 SDK 能力，不表示服务端已验证。迁移时必须先定义身份与房间频道权限，保留现有 payload/响应映射的兼容测试。

| 入站事件 | 当前处理与迁移要求 |
| --- | --- |
| wave、raise、raise_accept、raise_cancel | 定向或广播举手/互动；校验发送者、目标、房间与角色 |
| remove_participant、invite_device、req_record、recording、control_participant | 管理/设备/录制通知；后端授权后发送，不能只凭目标 socketId |
| update_user_status、refetch_room、new_user_status、re_init | 状态/重新初始化通知；区分系统来源和成员来源，避免广播跨房间数据 |
| mouse_move、mouse_click、mouse_remove、whiteboard_sync、whiteboard_clear_all | 互动同步；按房间作用域与权限分发 |
| chat_msg、chat_file | 写 `chat:*`、可写本地文件、广播消息；抽消息存储与文件适配，修复读改写并发与会话归属 |
| reload_virtual、tile_player_change | 重载/播放器通知；绑定正式会话与房间 |
| join_privacy_room、removed_from_privacy_room | 私密子房间通知；不能将前端过滤当授权 |
| clear_space_resources、reload_env | 删除上传目录/聊天与刷新配置；需服务端命令授权与审计 |
| disconnect | 延迟 5 秒后以 socketId 回调 `/api/space` 删除成员，再延迟通知；以业务会话和连接代次取代仅 socketId 判断 |

任务归属：启动时 GET heartbeat 触发 route 内 interval；disconnect 有延迟清理/通知；录制 API 调 `lib/s3-clean.js` 安排对象清理，server.js 启动时 rebuildCleanTasks。迁移到 worker 前先定义持久任务记录、幂等、失败恢复、唯一执行者；保留本轮原调度，禁止新旧并行跑同一清理任务。

## 数据与唯一写入方

| 数据 | 当前位置 / 写入方 | 拆分原则 |
| --- | --- | --- |
| 空间/成员/子房间/权限/应用 | Redis `space:*`，SpaceManager（在 route 内） | 首轮保留 key 和结构，抽 repository 后再提供服务接口 |
| 时间记录与运行日志 | `space:date:records:*`、`heartbeat:log:*`、`cleanup:record:*` | 保留统计口径和保留上限，任务由唯一 worker 拥有 |
| 聊天 | Redis `chat:*`，server.js 写，SpaceManager 读/清理 | 统一 repository；不能在两个后端各存一份历史 |
| 配置 | vocespace 配置文件、getConfig、STORED_CONF；配置 route 与 webhook 写 | 区分动态配置与启动配置，服务端 secret 不进入公开能力响应 |
| 本地文件 | `uploads/`，upload/feedback route 与 Socket 写，文件 route/Express 读 | 保留挂载与路径兼容，统一鉴权与清理所有权 |
| 许可证 | `sql/` 下 JSON，由 lib/db/license.ts 写 | 不是现成的关系数据库；后续事务系统需另选存储 |
| 录制 | S3 与 Egress；`lib/uploads/S3_clean.json` 保存清理任务 | 对象、任务、许可分别管理，迁移时保留恢复能力 |
| 进程内状态 | Socket server 全局桥接、processingSocketIds、heartbeat interval、配置快照、清理 timers | 多副本前显式选择共享/租约机制，不能默认进程内状态跨实例可见 |

## 身份与迁移前必须解决的边界

当前 Space 名称同时作为 URL 与存储键；普通 RTC identity 使用 `name__space` 或客户端传值；平台 token 使用 id/space/identity 等字段；成员设置保存 socketId。尚未建立稳定的 accountId / tenantId / spaceId / business sessionId 映射。

迁移约定：保留旧 Space 名称链接；新身份协议使用服务器验证的账号或受控访客会话，稳定 spaceId 与旧名称通过兼容解析关联；RTC participant identity、业务 sessionId 与可变 socketId 分开。具体字段、访客签发及平台一次性 code 协议仍需完成，不能把客户端昵称提升为可信账号。

已定位并纳入 B1/B2 后续验收的债务：

- 平台解析在验签失败后 decode，普通入房 `white_platform` 接受客户端 identity；POST 平台签发及管理动作缺少统一会话授权。
- 平台跳转 URL 带连接详情和 token，cookie postfix 可能为 undefined；需配套一次性 code / 会话迁移，避免本轮破坏平台协议。
- `clearReadableConf` 直接返回完整 livekit 配置，`/api/record?env=true` 返回 S3 凭证字段，server.js 启动日志输出 Redis 密码；服务分离时必须去除并替换调用方。
- 创建策略、允许访客、角色及子房间权限并未统一为所有 HTTP/Socket/RTC 入口共用的服务；当前提取不能标记为已经解决。
- 普通入房仍通过同站 HTTP 检查空间，失败当作不存在；后续 repository 需区分不存在与存储故障，并有明确版本化错误语义。

本次没有部署这些接口或开启新的公网入口；上线独立后端/原生 App 前以上边界必须按相关模块完成校验与迁移。

## 已确定的实施顺序与回退

1. 保持当前 Next 根目录；通过源码别名先建立 contracts/domain/client-sdk/server-core，现有 Web 为第一个消费者。后端沿用已安装的 Express 方向，业务核心不依赖 Express；API 与 Socket 初期同进程。
2. 第一批普通入房与客户端兼容迁移；下一批稳定身份/授权契约与 Space repository，再迁移正式成员初始化、聊天写入和退出服务。
3. 随后迁移配置、文件、录制、AI、平台和管理；每批契约/集成/相关 Web 回归通过后切换，不双写。
4. B2 拆出 API/realtime/worker 并按同站代理切换。B3 才移动 apps/web、建立完整 workspace 构建、Compose/安装技能和服务升级回退演练。
5. B3 验收通过再开发正式 RN 工程；发现、商业化和商店发布依 app_plan 的后续子阶段推进。App 商业模式、发行主体/地区仍待产品定稿；Web 自建入口保持原能力。

本批不改数据 schema、端点路径和现有调用返回 Response 的约定；可回退本批代码恢复旧实现，无数据回填。普通请求缺失字段现在在空间查询前返回 400；媒体配置按请求快照读取，不再依赖旧模块加载时的快照；region 保留为兼容参数，沿用现有配置 URL，未新增区域路由能力。
