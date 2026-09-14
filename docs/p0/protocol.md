# P0 配置与实时协议基线

日期：2026-09-15。本文描述当前实现，不是推荐的新协议；P1/P2 结构迁移默认保留行为。源位置索引见 [source-inventory.json](./evidence/source-inventory.json)。

## 1. 配置读取与写入

| 来源 | 当前读取位置 | 优先级 / 生命周期 |
|---|---|---|
| 进程环境、.env.local、.env.development、.env | server.js | dotenv 按上述文件顺序读取且不覆盖已存在环境；进程环境优先，同名字段先读优先。生产启动也会遍历 .env.development |
| vocespace.conf.json | app/api/conf/conf.ts | 以 process.cwd() 拼路径；读取失败回退 DEFAULT_VOCESPACE_CONFIG；补 roomLicenses、smtp、hyperbeam 默认值 |
| vocespace.conf.json 中 redis | server.js | 独立实现，按 server 文件目录读取；返回默认字符串，与应用配置类型不一致 |
| STORED_CONF | app/api/conf/conf.ts | 模块导入时初始化；写配置后更新内存副本 |
| 路由顶层 getConfig() 解构 | connection-details、space、record 等 | 模块初始化时取得配置，不保证后续文件修改立即刷新这些绑定 |
| JSON 中 s3 | lib/s3-clean.js | 运行清理操作时读取；配置缺失返回空值 |
| 环境变量 SMTP_* | lib/email.ts | 与 JSON 邮件配置共同使用，实际调用以实现为准 |
| NEXT_PUBLIC_* | 浏览器代码/构建 | 不能假定运行时改环境即改变已有客户端 bundle |

现有变量读取清单包括 NODE_ENV、HOST、PORT、NEXT_PUBLIC_BASE_PATH、SERVER_HOST、LICENSE_SECRET、STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET、WEBHOOK、SITE_URL、HYPERBEAM_*、SMTP_*、NEXT_PUBLIC_DATADOG_* 和 SERVER_NAME。connection-details 还构造 LIVEKIT_URL_<REGION> 动态键；静态扫描不包含动态键实例。

本轮只读取仓库中的配置定义和示例，不读取或复制实际私有 JSON/.env 值。构建基线特意使用无配置副本，不能代表生产配置已验证。

### 配置 API

- GET /api/conf 可带 hostToken 查询参数，调用 clearReadableConf()，返回 initialized，设置禁止缓存响应头。
- 当前 clearReadableConf() 直接返回 livekit 对象；匹配管理员 token 后额外返回 AI/SMTP/Hyperbeam 配置。livekit 类型包含 key/secret，公开边界需在 P6-01 收窄。
- POST /api/conf 通过 setup、create_space、check、ai、smtp、hyperbeam、license 等查询参数分支处理。认证检查并非所有分支一致；P6-01 需逐分支确认，不在 P0 改行为。
- writeBackConfig() 写回 JSON 并更新 STORED_CONF；不是统一环境覆盖机制。
- GET /api/record?env=true 当前可返回对象存储配置字段，包括凭据；列为已有接口风险，P6-01 同步迁移调用方。

### 数据路径

| 数据 | 当前路径 | 注意 |
|---|---|---|
| 应用配置 | 根目录 vocespace.conf.json | 启动工作目录影响路由解析路径 |
| 本地上传 | 根目录 uploads/<roomName>/ | server 暴露 <basePath>/uploads |
| S3 清理任务 | lib/uploads/S3_clean.json | 实际路径与注释“项目根 uploads”不同 |
| 聊天历史 | Redis chat:<roomName> | 读写整段 JSON 数组；当前实现非原子追加 |
| 用户选择 | 浏览器 localStorage | 迁移保留 key 与版本兼容 |

## 2. Socket 连接与广播语义

客户端在 PageClientImpl 模块顶层调用 io()：reconnection=true、reconnectionDelay=1000、reconnectionAttempts=5、timeout=30000、forceNew=true、transports=[websocket,polling]。默认同源 Socket.IO 路径。

server.js 将 Socket.IO 挂到自定义 HTTP server。当前下列业务广播没有统一使用 Socket.IO 房间分组；部分消费者根据 space/roomName 做过滤。字段叫 space 并不代表服务端已经按空间隔离广播。

范围说明：目标连接 = socket.to(socketId)，其他连接 = socket.broadcast.emit，全连接 = io.emit。以下 26 项业务输入外还有 connection/disconnect 生命周期事件。

| 输入事件 | 输出事件 | 范围 / 副作用 | 负载依据 |
|---|---|---|---|
| wave | wave_response | 目标连接 | WsWave/WsTo；包含 space、发送/接收方、socketId |
| raise | raise_response | 其他连接 | WsSender，包含可选 senderSocketId |
| raise_accept | raise_accept_response | 目标连接 | WsTo |
| raise_cancel | raise_cancel_response | 目标连接 | WsTo |
| remove_participant | remove_participant_response | 目标连接 | WsTo |
| invite_device | invite_device_response | 目标连接 | WsInviteDevice：device、isOpen |
| req_record | req_record_response | 目标连接 | WsTo 风格，按 socketId 转发 |
| recording | recording_response | 其他连接 | 消费端按 WsBase.space 过滤 |
| control_participant | control_participant_response | 目标连接 | WsControlParticipant：type、可选 username/volume/blur |
| update_user_status | user_status_updated | 全连接 | WsBase.space |
| refetch_room | refetch_room_response | 全连接 | 原负载透传，消费者过滤 |
| mouse_move | mouse_move_response | 其他连接 | WsMouseMove：坐标、realVideoRect 等 |
| mouse_click | mouse_click_response | 其他连接 | WsMouseClick |
| mouse_remove | mouse_remove_response | 其他连接 | 发送/接收者与 space |
| whiteboard_sync | whiteboard_sync_response | 其他连接 | WsWhiteboardSync：handWriting |
| whiteboard_clear_all | whiteboard_clear_all_response | 其他连接 | space、senderId、receiverId |
| chat_msg | chat_msg_response | 其他连接；可选 Redis 保存 | ChatMsgItem |
| chat_file | chat_file_response / error | 成功全连接；失败仅发送者；可写本地文件/Redis | ChatMsgItem.file，必要时构造 id/url |
| reload_virtual | reload_virtual_response | 其他连接 | 原负载透传 |
| clear_space_resources | 无回复事件 | 删除 uploads 下空间目录及 Redis 历史 | spaceName；有破坏性，仅隔离测试资源可用 |
| new_user_status | new_user_status_response | 全连接 | 原负载透传 |
| join_privacy_room | join_privacy_room_response | 目标连接 | WsJoinRoom：childRoom、可选 confirm |
| removed_from_privacy_room | removed_from_privacy_room_response | 遍历 socketIds 逐个发送 | WsRemove：participants、childRoom、socketIds |
| reload_env | reload_env_response | 全连接 | WsBase.space，客户端设置 reload 标记 |
| re_init | re_init_response | 全连接 | WsParticipant：participantId |
| tile_player_change | tile_player_change_response | 全连接 | WsTilePlayer：created、可选 ty/playerId/ownerId/action |

多数转发没有服务端 schema 验证和 ACK；上述类型来自 lib/std/device.ts 及调用点，类型定义不是运行时验证。语义迁移前对照实际消费者，不能假定发送成功等于目标业务完成。

## 3. 聊天契约

ChatMsgItem 字段为可选 id，sender={id,name}，message:string|null，type=text|file，roomName，timestamp，以及 file:null 或 {name,size,type,url?,data?}。

- 文本发送先写本地 store，再 emit；服务端向其他连接转发，发送者不再收到同一文本广播。
- 接收者检查 roomName；打开聊天时清零未读，未打开时递增。
- 文件已有 url 时透传；没有 url 时服务器保存上传内容、生成 id 和 url，再向所有连接回复。
- 文件消费者按 id 去重，自己的文件不增加未读；服务端错误仅为通用 error 事件。
- 没有业务层送达确认、重连补发保证或全局幂等键。P5 的 chat_message_submitted 必须保持“提交”语义。

## 4. 断线、退出与状态刷新

服务端 disconnect 后：按 socket.id 防重复处理 → 等待 5 秒 → 检查同一 id 是否重新存在 → 若没有则 DELETE 本机 /api/space?socketId=... → 成功后延迟 3 秒广播 user_status_updated → finally 再延迟 5 秒移除处理中标记。

Socket 重连可能改变 id；当前按旧 id 检查不等价于逻辑用户恢复。P2 需要实测和保留当前行为基线，不直接将等待时间视为正确性保证。

启动后服务端还调用本机 /api/space?heartbeat=true，并恢复 S3 清理任务。因此 P0 不启动带真实配置的应用服务做随意冒烟。

客户端 Room 的主动退出与非主动断开不同；前者由 explicitLeaveIntent 标记控制并执行 leaveSpace/清理/Socket 断开/回首页，后者不执行同一路径。相关行为已由 P0 部分测试覆盖，完整页面与服务端断线联动仍需后续真实回归。

## 5. 埋点接口语义冻结

事件名称和属性以 [plan.md](../../plan.md) 的 A01–A22 为唯一字典，不在本文件复制。映射约束：LiveKit 已连接才算 join_succeeded；Socket 与 LiveKit 重连分别计数；按钮点击不是媒体成功；录制请求接受与实际状态分开；聊天提交不等于送达。P0 不加载 Umami 或发送事件。
