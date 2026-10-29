# 会议拉黑与举报（2026-10-28）

## 身份与数据边界

此功能使用 Redis `space:<name>` 的 `SpaceInfo.blacklist: string[]`，与 Supabase `SBTSpaceTb.blacklist` 无关。旧 Redis 数据缺少字段时按空数组读取，新建 Space 默认空数组。名单随该 Space 的数据生命周期保存，本次不提供解除拉黑入口。

名单包含被拉黑的会议 participant ID，以及服务端为其绑定的会话 ID。Web 平台登录的 participant ID 是已验证的平台 ID；Native 每次入会产生新的媒体 ID，因此还按 Native 会话阻止新 joinId / 新媒体 ID 绕过。关联映射 `v1:member-session:<space>:<identity>` 由令牌签发、已确认的 Native 成员校验及已验证的 Socket 会话写入；不使用昵称、客户端上报角色或可编辑的 LiveKit metadata 判定身份。

当前 Native 账号登录与 RTC 访客会话仍是两个体系，不将 Supabase UID 假装成已绑定的会议身份。匿名用户清除会话或换设备后没有可验证的同人身份；本功能不承诺识别这种新访客，也没有引入设备指纹。

## 拉黑流程

- Native `POST /api/v1/native/moderation`：`joinId`, `targetId`, `confirm: true`，凭 Native Bearer 会话和已确认成员关系授权。
- Web `POST /api/v1/moderation`：`spaceName`, `targetId`, `confirm: true`，凭 Web 会话、同源及请求头校验授权。
- 仅持久化数据中的房主 / Space 管理者可以操作；禁止拉黑自己、房主以及关联至房主或操作者的同会话连接。
- CAS 保存前复核权限，保存名单并删除主/子房间成员、撤销管理员身份、更新预览 epoch，再通过 LiveKit 移出所有关联连接并清理 Socket 房间。
- Web 取令牌、旧业务写入、Native prepare / confirm、成员及 Socket 校验都检查名单。旧的设置 / 心跳保存通过 CAS 合并黑名单，不允许覆盖名单或复活被禁成员。
- 媒体移出失败时返回失败，名单仍保留；worker 每轮（正常间隔 15 秒）重试，并清理旧令牌重连的媒体连接。已签发的 LiveKit 令牌无法仅靠 Redis 原子撤销，实际媒体断开及旧令牌重连行为仍需部署环境双端回归。

## 交互与举报

Native 普通 / 聚焦 / 全屏 Tile、Web 普通与缩略 Tile 长按 500ms 打开成员面板。Web 拖动、取消及卸载清理计时器；Native 使用 Pressable 长按，并将 AVO 子层长按接到同一个动作。面板复用成员列表的 InitialAvatar；只有可管理目标才显示拉黑按钮，点击后再次弹出确认框，未确认不请求 API。

公共 `FeedbackForm`、Native `FeedbackContent` / `FeedbackDialog`、Web `FeedbackDialog` 接收用户指定的 `varient?: FebType`。`FebType.Feedback` 为原问题反馈，`FebType.Report` 为用户举报，复用邮箱、附件、上传、草稿及提交逻辑。已登录邮箱沿用现有适配器自动填写。举报原因提供骚扰辱骂、垃圾信息、违规内容、其他；中英俄词典同步。

举报使用现有反馈通道与 SMTP，邮件主题标识 User Report。服务器核对举报者和目标的 Space 成员关系，目标名称和 Space 由服务端读取，忽略客户端伪造的展示字段；邮件中的输入转义。失败不显示成功。此功能是提交人工审核请求，不自动处罚被举报人。

## 验证与发布

- 当前全量测试 77 项通过，包括权限、受保护目标、同会话重入、并发权限变化、失败保留名单、举报身份校验、表单邮箱 / 原因、独立 Redis CAS / 空数组行为。Redis 测试启动独立 Unix socket 实例，不访问用户数据。
- 根 / API / Mobile / UI 类型及依赖边界通过；相关 Web lint 仅原有 Hook 警告，隔离标准 Web / API 生产构建通过。
- 390×844 浏览器静态实验页实际长按打开面板、举报表单完整显示，未发送邮件、未上传文件、未拉黑真实用户。
- 更新 Web、Mobile JS 与 API，并重启 API 加载路由和 worker。没有新增 Native 模块，无需因为本功能重新 prebuild；现有原生基础包仍按已有发布要求构建。
- 真实 LiveKit 移出、双端重入拒绝、iOS / Android 真机长按及 SMTP 实投待测试账号回归。静态实验页仅检查共享 UI，不能视为真实会议验收。

本地 API 已加载新构建：健康检查 200，两条 moderation 路由的匿名请求均为 401。没有通过真实账号执行拉黑或举报。
