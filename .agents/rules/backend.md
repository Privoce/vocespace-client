> 2026-10-11：旧后端 lib 已迁入 services/api/lib，realtime/worker/preview 归 services/api 内部模块；数据相对路径不变。Web API 类型不得反向导入，旧请求形状在 domain/requests。独立部署参见 docs/independent-deployment.md。

# 服务端、协议与数据规范

## HTTP 与服务层

- route 负责请求解析、会话上下文及响应映射；业务决策放 server-core，通过端口注入存储、配置、签发与外部服务。
- DTO 独立于 Redis / 数据库结构和 LiveKit 对象；新增输入需要运行时校验。先保留旧接口的状态码、正文和 Cookie/重定向行为，再设计版本化替换。
- `createLegacyConnectionService` 是现有入房语义的提取，不是可信 App 授权。`/api/v1` 与兼容入口现在共用会话/授权 dispatcher；外部入房须先经过可信会话检查。发现流仍未实现，不能复用 legacy 的客户端 identity 规则。
- 不将 nickname、客户端 identity、isAuth、socketId 作为新功能的可信授权依据。HTTP、Socket、任务与媒体令牌应共用后端权限来源。
- 新平台认证不得在签名失败后回退 decode 接受身份；长期凭证与 RTC token 不应放跳转 URL。现有兼容路径的债务在阶段 4 盘点文档记录，替换时需要平台联调。

## 存储和任务

- 迁移前记录 Redis key、文件路径、对象存储、写入方、TTL 和副作用。初期保留数据结构及唯一写入方，不因抽服务另建一份业务状态。
- 不能在导入共享库时连接 Redis、读写配置或启动任务；副作用由组合入口负责。
- 任务必须定义幂等键、重试、取消、异常状态和重启恢复；搬迁 heartbeat、录制清理或预览任务时确保新旧进程不重复调度。
- 密钥仅在服务端适配器读取，不进入 DTO、客户端 bundle、日志、测试快照或文档示例。不要打印用户本地配置文件内容来做排查。
- 数据迁移优先向后兼容，明确升级与回退；不以 Redis 缓存代替未来交易记录的可靠持久化。

## 发现流后续约束

用户 2026-10-11 已要求元数据目录发现全部允许访客的业务 Space，不再使用 env 白名单。音视频公开预览仍须主持人明确授权，旧 Space 默认不开放预览。预览不创建正式成员，不读取私密聊天或调用完整会议初始化；只输出授权音视频轨道。正式加入经服务端容量预留、RTC 确认和幂等提交后生效，取消需要服务端补偿。完整时序与验收遵循 `app_直播.md`；它描述未来需求，不证明当前已实现。

## 4.2 实施约束

- 会话/一次性 code 存 Redis；浏览器使用 HttpOnly Cookie，平台验签代码只放 `services/api/lib/server/platform-token.ts`。`services/api/lib/hooks/platformToken.ts` 仅为服务端兼容导出，不可进入客户端依赖图。
- 平台新接入使用 POST body，登录跳转仅携带 60 秒一次性 code。旧 GET JWT 入口仅为兼容，不能新增长期凭证查询参数。验证失败不得回退 decode。
- 旧和 v1 请求必须经过 `services/api/access.ts`；新增动作同步更新授权矩阵，不能利用 pre/nameCheck 等公共参数绕过管理动作。调用者提供的 identity/role/isAuth/socketId 不作权限依据。
- Socket 在握手成功前完成会话/频道准备，每个事件重读当前会话和成员；通知只能发给获准 Space/目标 Socket。聊天用 Redis 原子写入和稳定 ID 去重，控制性事件先鉴权。
- HTTP 与 worker 共用原持久化，业务 handler 不启动 timer。部署/重启必须确保旧 server.js 任务停止；本阶段不支持多 API 进程共享本地文件并发写入。

## Monorepo 启动

services/api/start.mjs 通过 --config 或工作区根目录定位 vocespace.conf.json，按 deployment.dataDir（相对配置文件）固定数据目录，在导入业务模块前切换 cwd。运行时不加载 .env 或旧业务环境变量。默认 prompt / preview 资源来自制品 dist，也可在 deployment.api 中指定路径；配置/上传/sql/清理队列继续由单 API 写入。结构入口为 packages/domain/src/config.ts，Node 读取器为 @vocespace/config-node；客户端仅使用显式公开投影。不得因移动目录重置用户数据。

## Native 观众试运行

Native 会话使用显式 Bearer + JSON，拒绝浏览器 Origin / Sec-Fetch-Site，不从 Cookie 返回明文凭证。Native 凭证不得走 legacy 发布/管理接口。当前允许访客的业务 Space 自动进入目录并可手动加入，NATIVE_CONFERENCE_SPACE / NATIVE_CONFERENCE_SPACES 已忽略。包含私密子 Room 不排除整个 Space；Native 仅进入主房间/公共 Room，目录不返回私密 Room，私密轨道由 Web 发布端订阅规则拒绝 Native。新建 Space 保留两个默认公开 Room，Web 私密 Room 原功能保留。E2EE 未开放 Native 支持。业务成员确认须查询媒体服务，取消先写墓碑，成员原子写入需保留 JSON 空数组。细节与尚未完成的媒体撤销/对账见 docs/native-observer-pilot.md。

Native 邀请发布（2026-10-10）：初始观众令牌不变；通过 `/api/v1/native/media` 接受主持人 60 秒单设备邀请，开放独立的 microphone/camera/screen source，不授予屏幕音频或数据权限。接受时重验邀请人管理权限和 Native 成员/RTC 绑定；关闭设备需在 LiveKit 撤销 source。此授权仍受已确认公共 Room 成员和单 API 写入者约束，协议及未验收范围见 docs/native-meeting-controls.md。

2026-10-11 全量发现更新见 docs/native-space-discovery.md：主房间/公开子 Room 的成员、聊天与订阅按已确认 joinId 校验。切换先退出再加入；目录只读，浏览不写业务成员。Native 不再限制 Web 创建和管理私密 Room，确认与会中访问时重验自身目标 Room 为公共。此目录不替代未来主持人公开源授权与预览租约；原生私密轨道隔离需两端更新并通过真实 RTC 验证。

2026-10-11 预览更新（覆盖上文早期单轨方案）：用户指定直接预览 Space 主会场，全部子 Room 均不输出；部署 PREVIEW_ENABLED 显式开启允许访客的业务 Space 预览。services/api/preview 是独立 Egress 模板/出口适配，用户只播放 HLS。短期 lease 与源 capability 分开；每份媒体文件都重验权限。原 Space 写入同步更新子 Room 变化 epoch，旧 HLS 必须失效；清理只访问 vocespace-preview/<job-id>/。任务由单 API 写入和现有 worker 租约对账。详见 docs/native-space-preview.md。

## 2026-10-11 Native 创建与设置写入（覆盖早期仅观众/只读范围）

用户已明确授权接通创建、会中设置及数据接口，当前实现见 docs/native-service-parity.md。匿名 Native 创建受部署策略控制，不能凭昵称命中指定用户白名单；Lua 原子创建保留两个默认公共 Room，创建者凭据绑定服务端会话。RTC 确认后授予创建者媒体源权限，仍不自动启动设备。重新入会使用新 RTC identity 并原子续接所有权，迟到退出不影响新连接。

POST native/settings 读取自身快照；PUT 用严格字段补丁，自身偏好与房主策略/RBAC/应用配置分权。持久化使用原 Space 数据与 CAS，并原子重验会话、joined 状态和撤销标记。录制列表/下载/删除单独校验成员和操作权限，文件限定在本 Space 直接 MP4 对象，短期签名链接，不能泄漏存储凭证。Native 凭证继续禁止走 legacy 管理入口。

房主身份不是部署管理员权限。AI 部署密钥、证书、订阅与控制台不得借房主设置接口开放；视频效果、共享音频等 Native 媒体能力需要独立实现和真机验收，不以偏好保存成功代替。匿名所有权与偏好随当前会话过期，未来外部身份集成需明确迁移策略。
