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

公开发现必须由主持人明确授权，旧 Space 默认关闭。预览不创建正式成员，不读取私密聊天或调用完整会议初始化；只输出授权音视频轨道。正式加入经服务端容量预留、RTC 确认和幂等提交后生效，取消需要服务端补偿。完整时序与验收遵循 `app_直播.md`；它描述未来需求，不证明当前已实现。

## 4.2 实施约束

- 会话/一次性 code 存 Redis；浏览器使用 HttpOnly Cookie，平台验签代码只放 `lib/server/platform-token.ts`。`lib/hooks/platformToken.ts` 仅为服务端兼容导出，不可进入客户端依赖图。
- 平台新接入使用 POST body，登录跳转仅携带 60 秒一次性 code。旧 GET JWT 入口仅为兼容，不能新增长期凭证查询参数。验证失败不得回退 decode。
- 旧和 v1 请求必须经过 `services/api/access.ts`；新增动作同步更新授权矩阵，不能利用 pre/nameCheck 等公共参数绕过管理动作。调用者提供的 identity/role/isAuth/socketId 不作权限依据。
- Socket 在握手成功前完成会话/频道准备，每个事件重读当前会话和成员；通知只能发给获准 Space/目标 Socket。聊天用 Redis 原子写入和稳定 ID 去重，控制性事件先鉴权。
- HTTP 与 worker 共用原持久化，业务 handler 不启动 timer。部署/重启必须确保旧 server.js 任务停止；本阶段不支持多 API 进程共享本地文件并发写入。

## Monorepo 启动

services/api/start.mjs 固定数据目录，工作区默认沿用仓库根的数据，独立部署显式设置 VOCESPACE_DATA_DIR。API entry 在导入业务模块之前切换 cwd，避免模块级路径指向子项目。VOCESPACE_PROMPT_DIR 指向随制品打包的 prompt，业务配置/上传/sql/清理队列继续由单 API 写入。不得因移动目录重置用户数据。

## Native 观众试运行

Native 会话使用显式 Bearer + JSON，拒绝浏览器 Origin / Sec-Fetch-Site，不从 Cookie 返回明文凭证。Native 凭证不得走 legacy 发布/管理接口。当前 NATIVE_CONFERENCE_SPACE 只开放一个无子房间测试 Space，默认关闭，不作为公开 feed 授权。业务成员确认须查询媒体服务，取消先写墓碑，成员原子写入需保留 JSON 空数组。细节与尚未完成的媒体撤销/对账见 docs/native-observer-pilot.md。
