# 阶段 4.2 交付与切换说明

本批完成独立后端与 Web 传输切换。Umami 保持后置，未开始 RN、发现流和 Docker 安装工程。

## 实际结构

```text
Web hooks → lib/api → client-sdk → 同站 /api 或 /api/v1
                                    ↓
server.js / Next compatibility routes → services/api
                                           ├── services/realtime
                                           ├── services/worker
                                           └── lib/server → server-core / domain / contracts
```

- `services/api/entry.ts` 先加载环境变量，再启动 HTTP、Socket 和 worker。`build/api.cjs` 可独立运行，不依赖 Next、React、Ant Design；构建检查会拒绝这些运行时依赖。
- 16 组旧 HTTP 路由的实现迁至 `services/api/handlers`，原 Next route 只转发请求。旧路径和 `/api/v1` 经同一 dispatcher、授权及数据适配器，创建和消息不双写。
- `server.js` 只负责 Web 启动、同站 HTTP/上传代理、WebSocket Upgrade 与子进程生命周期；未指定外部 API 时自动启动一个 API 子进程。
- 核心库包含 DTO/校验、创建规则、会话、Space 存储端口、基于持久化所有权的授权及媒体签发端口。原 SpaceManager 保留为后端兼容门面；历史复杂业务仍位于后端适配器，未把整个旧业务模型包装成可跨端发布的包。
- Web 的配置、Space/子房间、聊天、上传/文件、录制/S3、AI、平台、反馈和后台请求统一通过 SDK transport。浏览器环境读取在 Web adapter 中，平台出站请求留在后端。

## 启动与配置

沿用当前工作目录下的 `vocespace.conf.json`、`uploads/`、`lib/uploads/S3_clean.json`、`sql/` 和 `prompt/`。API 必须在持有这些数据的项目目录启动。

开发时运行 `pnpm dev`；根入口会构建并启动 API，默认 Web 3000、API 127.0.0.1:3001。生产使用 `pnpm build` 后 `pnpm start`。显式分开运行：

```sh
pnpm build:api
pnpm start:api
# 另一个终端
VOCESPACE_API_URL=http://127.0.0.1:3001 pnpm dev
```

| 变量 | 作用 |
| --- | --- |
| `VOCESPACE_API_URL` | Web 使用已有 API；设置后不会再启动 API 子进程 |
| `API_HOST` / `API_PORT` | 默认 `127.0.0.1` / `3001` |
| `PUBLIC_ORIGIN` | HTTPS/反向代理部署填写实际外部 origin，例如 `https://space.example.com`；API 和 Web 使用一致值 |
| `NEXT_PUBLIC_BASE_PATH` | Web 与 API/Socket 使用相同部署前缀 |
| `API_UPLOAD_LIMIT_BYTES` | 默认 110 MiB 请求上限，给原 100 MiB 文件限制保留 multipart 开销 |
| `WORKER_ENABLED` | API 内默认运行唯一 worker；隔离测试使用 `false` |
| `PLATFORM_JWT_SECRET` | 平台双方配置的至少 32 字符 HS256 密钥；未配置或验签失败时拒绝平台登录 |

Redis 现在同时保存 Space、聊天及可信会话，正常入房需要启用。Redis 未配置时公开能力/初始化入口仍可用，受保护会话请求返回存储不可用。配置 Redis 连接参数后需重启 API。反向代理上传限制不得小于 API 上限，读取/写入超时至少 120 秒；代理 `/api/`、`/uploads/` 和 `/socket.io`，后者必须支持 Upgrade。本阶段只支持同站浏览器部署，不开启凭证跨域 CORS。

## 身份与协议

- 一个自建实例作为租户边界；Space 是实例内的房间名。平台账号来自严格验签的 `id/userId/sub`，限定到已签名的 `space/site`；访客获得服务端随机 identity，昵称不作为身份凭证。
- 一个 opaque session 绑定每个 Space 的 RTC identity，保存在 `v1:session:*`。Web 使用 HttpOnly、SameSite=Lax Cookie；HTTPS 时附加 Secure。有效期最长 7 天，平台会话不超过原平台 token 的到期时间。
- 新平台入口：`POST /api/v1/auth/platform`，JSON 为 `{token, auth}`。平台服务端拿到 `redirectUrl` 后让浏览器跳转；URL 只含 60 秒、原子消费的一次性 code。
- Web 使用 `POST /api/v1/session` 交换 `{code}`，再经 SDK 请求短时 RTC token。客户端不再接受 URL 中的 `data/details` 或 localStorage 作为认证；localStorage 仅缓存展示信息。
- 旧 `GET /api/connection-details?auth=...&token=...` 仅保留接入兼容，同样严格验签并返回 code 跳转；新集成使用 POST，避免凭证出现在入口 URL/代理访问日志中。旧平台固定密钥和验签失败后的 decode 回退已移除。
- `DELETE /api/v1/session` 撤销会话并关闭其 Socket；已接入预加入页的退出登录。离开会议与退出账号保持不同语义。
- 旧子房间邀请结构继续解析并核对目标 Space/子房间及当前 owner，不能把提交的 `platUser` 当作账号。旧邀请的 owner 字段不是新设计的签名邀请凭证；这一兼容格式应由后续邀请协议版本替代。
- `/api/v1` 复用既有成功响应结构；错误统一带 `code/message/requestId`，响应带 `X-API-Version`、`X-Request-Id`。旧路径保留成功响应，明确授权失败改为 401/403。分页限制 1–100，聊天历史仍保留旧数组形式，未引入发现流的 feed 协议。

## 动作授权矩阵

| 动作 | 后端要求 |
| --- | --- |
| hello、公开配置/录制能力、S3 能力检查、初始化/host token 检查 | 公开能力或初始化专用规则；已有配置覆盖需要当前 host token |
| 普通入房 / 创建 Space | 服务端会话、创建策略/白名单、平台范围及 allowGuest 检查；忽略调用者指定的 RTC identity |
| 预加入名字检查 | 限定 query 组合；混入 all、heartbeat 等管理参数不能绕过授权 |
| Space 详情 | 入房前只返回预加入配置；已有会话 identity 才进入成员视图 |
| Space 列表/统计/日志、flushdb、license CRUD、实例配置写入、旧 socketId 删除入口、平台 token 签发 | host 管理凭证，Web 通过 header 发送；RTC 质量/许可证写入也进入该规则 |
| 成员设置、状态、工作模式、个人 AI、个人应用数据 | 会话绑定身份；修改其他成员需要管理员，auth/role 由后端维护；socketId 必须属于该会话 |
| Space 设置、guest 策略、持久化、录制、S3 删除 | 持久化 owner/managers；通用设置不能改 owner/managers/participants/auth/children |
| 所有权/管理员操作 | 当前 owner；不信任正文中声明的操作者身份 |
| 子房间 | 成员、自身或管理权限；创建检查 RBAC，私密子房间按持久化成员/owner 检查 |
| 聊天、上传、文件读取、S3 下载 | 对应 Space 会话/成员；阻止跨 Space 和路径穿越；私密子房间文件额外检查；删除本人文件或管理权限 |
| TilePlayer 删除 | 持久化条目的 owner 或 Space 管理员 |
| 平台 todos / AI / user 代理 | 已验签平台会话；出站 uid/id 从会话重写 |
| 反馈、链接预览 | 已建立会话 |
| Stripe webhook POST | 原始正文及 Stripe 签名；不复用浏览器成员身份 |
| Socket 普通通知/聊天/白板/鼠标/状态 | 每次事件重读会话和成员；服务端覆写发送者；按 Space 频道发送 |
| Socket 录制通知、控制/移除成员、接受举手、邀请设备、管理通知 | 当前 Space owner/managers；目标 Socket 也必须属于同一 Space |

Socket 的具体事件分组由 `services/realtime/server.ts` 的 `eventPolicy` 维护。确认响应为 `{ok,id?,duplicate?,code?}`；聊天用稳定消息 ID 和 Redis Lua 原子追加/去重，去重窗口 24 小时。撤销成员后不再允许发送，发送前也会清理失效接收者的频道。踢人通过 LiveKit 管理 API 撤销媒体连接，而非仅通知客户端退出。

## 数据和任务所有权

| 数据 / 任务 | 唯一归属 |
| --- | --- |
| `space:*`、`space:list:`、历史统计/日志 | API 后端兼容服务与同进程 worker |
| `chat:*` | API 的 realtime 服务，保留旧 JSON 数组结构 |
| `v1:session:*` / `v1:code:*` / `v1:message:*` / `v1:revoked:*` | API 会话、code、消息幂等与成员撤销 |
| 配置、license 文件、本地上传、S3 清理队列 | 一个 API 部署持有；本阶段不支持多个 API 对同一本地目录并发写入 |
| 心跳 / S3 清理 | `services/worker`；Redis 租约协调执行，不从 GET route 或上传/录制请求中创建 timer |

S3 队列原路径保留，写入采用临时文件原子替换；重复 key 不重建任务，失败保留，下次轮询重试，重启从持久化队列恢复。worker 每 5 分钟对账；Socket 短暂断线不再用旧 socketId 删除成员，真正离线由 LiveKit 对账判断。退出 HTTP 请求成功后同步清理频道。Room/E2EE 的端内生命周期继续由 `UseRoomConnection`、`UseRoomLeave` 持有。

## 切换与回退

1. 备份配置、Redis、`uploads/`、`lib/uploads/S3_clean.json`、`sql/`。保持 API 工作目录和原数据路径一致。
2. 配置平台签名密钥与外部 origin，执行标准构建；先在隔离环境验证，再停止旧组合服务，启动新入口。不能让旧 server.js 的定时器与新 worker 同时访问生产数据。
3. **运行中的旧 dev/server 进程需要重启才能使用新入口。** 本次未停止用户已有服务；源文件 HMR 不会替换旧进程中的 Socket/启动代码。
4. 更新后需要重新登录/入房，旧昵称派生 identity 和旧 RTC token 不作为新会话认证。已有通话在进程切换时会断开；平台必须配合新密钥。
5. 回退时停止 API/worker，再恢复旧代码和必要备份，不能双跑比较写请求。旧 Redis Space/聊天 key 格式保留，但回退旧代码会恢复其旧授权规则；本批新加的 `v1:*` 数据旧代码不会读取。

## 验证证据

- 59 项 Vitest 测试：会话/一次性 code、权限、契约、SDK、存储、配置能力、平台 Web hook、录制 hook、清理重试/取消。
- 隔离 Redis + 独立 API + Socket 集成：28 项检查，覆盖伪造身份、越权/CSRF、参数混用绕过、上传/Range、跨 Space、原子消息去重、重连及撤销。
- 依赖边界、全项目 TypeScript、相关目录 lint 通过。
- 隔离源码副本标准生产构建通过，包含 API 构建、Next lint 和类型检查；存量警告保留，无错误。
- 生产 Web 主页、同站 HTTP/上传代理、WebSocket Upgrade 及 API 重启后的会话/消息幂等恢复通过；成员初始化和退出使用本地 LiveKit 管理响应模拟。

以上不是用户真实 LiveKit/S3/AI/平台、跨网络音视频或真机回归。阶段 4.3 的全站真实服务回归和升级演练仍保持未勾选；原阶段 1/2 的用户回归不能替代这次迁移验收。
