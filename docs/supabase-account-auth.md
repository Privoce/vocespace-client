# Supabase 账号接入（2026-10-27 更新）

## 本次范围

沿用 `vocespace_platform` 的 Supabase 项目和账号，不新建用户库。Mobile 登录/注册表单、忘记密码、我的页面退出登录与注销账号调用独立 API；删除了原演示账号校验及公开 env 密码。已有平台账号可直接使用；新注册账号按 Supabase 项目的邮箱确认配置处理，未确认时不伪装登录成功。新的密码至少 8 位，旧平台密码仍可用于登录。

账号 DTO 位于 contracts，验证/删除顺序位于 server-core，HTTP 客户端位于 client-sdk，Supabase REST 与 Redis 适配在 `services/api/account`。不把旧 Next 平台路由搬进客户端，也不引入第二份账号数据库。读取旧 `user_info.nickname/username` 显示昵称；无资料的新用户使用邮箱前缀，旧平台的资料完善流程保持独立。

本次不是 Space 所有权迁移：Supabase 账号令牌与现有 Native RTC 会话分离，登录不自动获得房主、录制、部署管理或发布权限。我的页面已移除关注/粉丝/获赞/时长统计卡和电竞标签，保留用户要求的会员标签；会员权益仍是此前 UI 原型，“我的内容”暂时注释隐藏；头像与昵称均有写回平台路径。Google OAuth 没有接入，Gmail 图标仍沿用原 UI 占位提示。Web 现有平台登录入口保持原行为，Web 重置页支持验证码以及旧链接回调；Native 在 App 内完成注册和验证码重置。

## API 与凭证

全部路径以 `/api/v1/account/` 开头；除 callback 为 GET、avatar 为 multipart POST 外，均为 JSON POST。

| 路径 | 输入 / 授权 | 结果 |
| --- | --- | --- |
| login | email、password | accessToken、refreshToken、expiresAt、user |
| register（兼容） | email、password | session 或 confirmationRequired |
| registration-code | email、password（至少 8 位） | 发注册验证码，不登录 |
| resend-registration | email | 重发 signup 验证码 |
| verify-registration | email、code（6 位数字） | signup 验证成功后返回 Native session |
| reset-code | email、code（6 位数字）、password | recovery 验证后改密码并撤销临时会话，不返回 token；浏览器另需同站 Origin 和 X-Vocespace-Request |
| refresh | refreshToken | 轮换后的 session |
| me | Bearer accessToken | Supabase 验证后的用户、平台昵称/username、头像 |
| avatar | Bearer accessToken、multipart file | 更新自身头像并返回用户；JPG/PNG/WebP/GIF，小于 2 MB |
| profile | Bearer accessToken、nickname | 更新自身 user_info.nickname 并返回用户；trim 后 1–30 个 Unicode 字符，不接受 UID / username 等额外字段 |
| logout | Bearer accessToken | 撤销当前 Supabase 会话 |
| forgot-password | email、delivery: code（新版） | 统一成功结果，不返回账号是否存在 |
| callback（GET） | 一次性 state、code | 固定站点内跳转，无长期 token 查询参数 |
| reset-password | 同站 Origin、X-Vocespace-Request: 1、HttpOnly 恢复 Cookie、password | 更新密码，消费恢复凭证 |
| delete | Bearer accessToken、当前 password、confirm: DELETE | 清理全部已确认平台数据后删除 Auth 用户 |

令牌接口拒绝浏览器 Origin / Sec-Fetch-Site，Native 不使用浏览器 Cookie。access/refresh token 只保存到 API 地址隔离的 Expo SecureStore，密码不持久化；未选“记住我”时仅保留内存会话。冷启动/前台恢复验证用户并按需刷新，网络错误保留可恢复的存储凭证，失效凭证退出登录。昵称和客户端传入 UID 不作为删除授权来源。

新版使用 Supabase `{{ .Token }}` 邮件模板和 `/auth/v1/verify`：注册固定 `signup`，重置固定 `recovery`，不能由调用者切换用途。注册首次发码使用 `/signup`，重发使用 `/resend`；发送后密码锁定，防止确认的账号密码与界面输入不一致。重置校验密码长度后才消费 code，失败可重新申请验证码。App 成功重置后回到登录页。

旧链接兼容流程仍使用 PKCE：Redis `v1:account-flow:<随机 state>` 保存 verifier 和类型，最长 1 小时；code 兑换后只在恢复流程签发 10 分钟、一次性 HttpOnly Cookie。密码重置不需要 App 跳转协议，用户在浏览器完成后返回 App 登录。邮件校验码仍受 Supabase 自身有效期限制。密码更新失败时恢复凭证已消费，需要重新申请邮件。

Redis `v1:account-rate:*` 提供认证动作的分钟计数（全局 200 次、同动作/账号或凭证哈希 10 次，所有注册/重发/找回邮件共用同邮箱每 60 秒 1 次）；Redis 不可用时失败关闭。普通账号请求体上限 20 KB；头像 multipart 单独限制为 2 MB + 64 KB（其中图片必须小于 2 MB）；Supabase 请求超时 15 秒；返回稳定错误码，不泄漏上游报错或密钥。

## 注销范围与失败语义

用户已确认全部删除，与旧平台意图一致。服务端通过 `/auth/v1/user` 验证当前身份，并用验证所得邮箱和用户输入密码重新登录校验 UID；不接受提交其他人的 UID/email 来选择删除目标。

1. 清理 `avatars`、`ai_analysis` bucket 下 `public/<uid>_*` 文件，按旧平台文件命名约定匹配并分页删除。
2. 删除 `space.owner_id = uid`、`todos.id = uid`、`ai_analysis.id = uid`、`user_info.id = uid`。
3. 最后调用服务端 Supabase Auth admin 删除用户；service role key 不进入 Web/App。

修正旧实现 Space 误按 `id` 删除，以及浏览器调用 admin API 的问题。操作跨 Storage/PostgREST/Auth，**不是单个数据库事务**：中途失败可能已有部分数据删除，接口返回失败且保留 Auth，允许同一用户重试；不会在仅删了资料后提示成功。App 必须再次输入密码并明确确认。不会删除别人的共享 Space、整个 bucket 或无归属依据的文件。

这里“全部”指旧平台已知的上述数据和上传文件；当前 VoceSpace 的匿名 RTC 所有权、独立录制存储没有 Supabase UID 绑定，不凭猜测批量删除。未来增加 bucket、文件命名或用户表时必须扩展并测试清理映射。生产需用测试账号核验实际表约束、RLS 和文件命名；本批未执行远程数据删除。

## 配置

API 的 `.env.local` 或部署环境需要：

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
ACCOUNT_PUBLIC_URL=https://vocespace.com
```

`ACCOUNT_PUBLIC_URL` 是用户打开邮件时访问的 **Web 地址**，包含部署 base path，不是 LiveKit 的 wss 地址。Web `/api/v1/*` 需同站代理到新 API。服务端密钥只传给 API；Compose 已添加对应变量，Mobile 只需要原 `EXPO_PUBLIC_API_URL`。

在同一 Supabase 项目的 Authentication → URL Configuration → Redirect URLs 添加对应回调，例如：

- 本机浏览器测试：`http://localhost:3000/api/v1/account/callback?state=*`
- 生产：`https://vocespace.com/api/v1/account/callback?state=*`

如部署有子路径，回调与 ACCOUNT_PUBLIC_URL 一并带上。API 仅在开发模式允许 localhost 的 HTTP。新版注册和找回邮件均使用 Supabase 的 `{{ .Token }}` 模板，并将邮件 OTP 长度设为 6 位。必须开启注册邮箱确认；如果关闭，新版发码会拒绝直接登录并提示配置异常。旧链接客户端如仍保留，才需要确认链接与 RedirectTo/code 回调；确认 Email provider 开启、注册开关和邮箱确认策略符合需求，并配置可向测试邮箱发送邮件的 SMTP。Supabase 默认邮件服务对收件人/速率有限制，不能仅凭 API 成功判定邮件已投递。参见 [密码认证说明](https://supabase.com/docs/guides/auth/passwords) 和 [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)。

本机已从旧平台复制三个必要 Supabase 配置到被 Git 忽略的 `services/api/.env.local`（权限 0600），未输出密钥；旧链接回调默认 `http://localhost:3000`。如果仍通过邮件链接在真机打开，应改成真机可访问的 HTTPS Web 地址，并同步 Supabase allowlist。没有修改线上 Supabase 设置。更新 API 后重新加载 App；新版验证码重置直接在 App 完成，旧链接重置还需要 Web 正常运行。此变更未增加原生依赖。

## 验证与待回归

认证专项测试覆盖输入校验、邮箱确认、过期刷新、存储失败、删除重认证/身份不匹配、分页文件清理、失败停止、Native 传输限制、限流、PKCE 单次回调、恢复 Cookie 与 CSRF 拒绝。所有依赖使用隔离模拟，不发真实邮件、不修改远程账号。

真实验收仍需要：旧账号登录/重启恢复、新邮箱注册确认、邮件重置后新密码登录、专用测试账号创建各类旧平台数据并确认注销清空，及 iOS/Android 真机 Keychain 行为。未完成这些验证前不标为生产账号流程已验收。

本批自动结果：241 项 Vitest（47 文件，其中认证专项 24 项）、187 项隔离 HTTP/Redis/Socket 检查通过；根/API/Mobile/UI 类型、边界、相关 lint、安装检查、Compose config、iOS/Android JS 导出通过。标准 `pnpm build` 在 /tmp 独立依赖副本通过（保留既有 Hook/img lint 警告），没有覆盖正在运行的 Web 构建目录。JS 导出不代表原生编译或真机通过。

## 2026-10-26 账号与“我的”页面

- “记住我”已有实现，新增了取消勾选后重启不恢复的回归测试；不保存密码或邮件验证码。
- `/me` 在 Supabase 验证 UID 后读取同 UID 的 `user_info.username`。主房间使用这个唯一用户名，兼容旧平台无资料时使用已验证邮箱的规则，不再用 `u-UID` 或可编辑昵称拼接。仅展示主房间，不把其他自建 Space 混入主卡片；没有变更 RTC 权限或自动取得旧 Space 所有权。
- Native 新增六格验证码输入（一个原生输入框支持粘贴/自动填充），注册/重置页面，以及基于截止时间的 60 秒重发倒计时。
- 我的页面显示邮箱，删除电竞标签、统计卡及“v1.0.0 静态原型”文案。帮助与反馈进入独立页面；会议继续弹窗。两种容器共用 `FeedbackContent`、公共 `FeedbackForm`、文件选择和 `sendFeedback` 传输，不为了反馈创建 RTC 连接。登录邮箱自动填入。
- 关于页面和会议设置共用 Native `AboutContent` 与公共 `AboutSettingsContent`，保持邮箱与官网链接。
- 269 项单元/Hook 测试、187 项后端隔离检查、根/API/Mobile/UI 类型、边界、相关 lint、隔离标准 API/Web 构建、iOS/Android JS 导出通过。Web 窄屏重置页在本地隔离端口验证；未发送真实邮件、上传反馈附件、删除或改动真实账号，也未改远程 Supabase 配置。
- 发布时同时更新 API 与 App/Web。待真机回归：注册邮件验证码、60 秒重发、重置后新密码登录、记住我重启恢复、主房间进入、反馈附件/邮件及关于页返回导航。JS 导出不代表真机验收。

OTP 依据：[Supabase 邮件模板](https://supabase.com/docs/guides/auth/auth-email-templates)、[Auth REST verify/resend](https://github.com/supabase/auth/blob/master/README.md)。


## 2026-10-27 头像与弹窗

- 头像优先读取旧平台 `user_info.avatar`，缺失时兼容 Auth `user_metadata.avatar_url`；仅输出无用户名/密码的 HTTPS 图片地址。没有头像或加载失败时，取唯一 username 的第一个 Unicode 字符，英文字母大写；首次资料尚未返回时用已验证邮箱回退。
- 点击头像或编辑资料中的“更改头像”，通过现有系统文件选择模块选择图片。头像与反馈共用 `ui/document-picker.ts`，旧 development build 缺失模块时提示重建，不在导入时崩溃。没有新增原生依赖；没有增加裁剪流程。
- API 先用账号令牌验证身份，再在原 `avatars/public/<uid>_*` 路径上传，使用用户 JWT 和 RLS，不用 service role。新建缺失的资料时不覆盖已有 username；只更新自身 `avatar`，确认资料写入后才清理自身旧头像。确定失败时回滚新文件；结果不确定的超时保留文件，避免删除可能已经引用的头像。清理失败的同 UID 文件仍在注销清理范围内。
- App 上传成功后更新头像和“记住我”会话；从文件选择器返回时等待前台会话恢复，避免和刷新争抢导致上传未执行。
- “我的内容”布局和入口注释保留。共享 `meetingColors.modal` 设为 `#1f1f1f`，用于 Native 编辑资料/反馈/选择弹窗、会议 Sheet 和 Web Modal；Phone 设置背景同步。
- 280 项测试、190 项后端隔离检查、类型/边界/安装检查、隔离生产构建和 iOS/Android JS 导出通过；Web lint 保留已有警告。新增大文件 HTTP 检查，413 响应显式关闭连接，避免客户端复用已关闭的连接。本次不连接远程 Supabase 上传或删除真实头像。待回归：旧头像显示、文件选择与取消、成功更换后重启恢复、旧 development build 提示、实际 Storage/user_info RLS 权限。

Storage 接入依据：[Supabase 标准上传](https://supabase.com/docs/guides/storage/uploads/standard-uploads)、[Storage RLS](https://supabase.com/docs/guides/storage/security/access-control)。

## 2026-10-27 昵称写回与原生文件选择

- 昵称由本机显示改为 `POST account/profile` 保存至原 `user_info.nickname`，仅接受 trim 后 1–30 个 Unicode 字符，拒绝其他字段。API 重新验证 Bearer 对应 UID，以用户 JWT 执行写入；新资料以忽略冲突方式补建，不覆盖已有 username。PATCH 未返回当前 UID 与确认的新昵称时不报成功。
- 保存期间使用现有账号请求互斥；成功更新 App 展示及已选择“记住我”的 SecureStore 会话。失败保留编辑内容与弹窗。会员、username、主房间及 RTC 权限不变。
- 头像提示缺少模块发生在本地文件选择前；已重建并安装本机 iOS 模拟器 App，实际公共 `pickDocument` 已验证打开系统选择器和取消返回。没有执行真实上传；其他设备按 [Mobile 构建说明](../mobile_build.md)更新安装，旧包无法通过 JS 热更新添加原生模块。
- API 与 App 需配套更新后验证远程昵称及头像流程；本批未修改真实 Supabase 用户、RLS 或上传文件。发布状态见 checklist，后续只处理测试发布，不扩展账号房间权属。


## 2026-10-28：Web 注销入口

新增 `/deleteAccount` 页面，以三语说明关联资料 / Space / Todo / AI / 上传文件删除范围。`POST /api/v1/account/web-login` 验证密码后把 access token 放入 Redis 的 600 秒专用会话；浏览器仅收到邮箱和不透明 HttpOnly / SameSite=Strict Cookie，HTTPS 下带 Secure。`web-session` 仅恢复邮箱，`web-logout` 清理专用会话；`web-delete` 需要 Cookie、同源 Origin、自定义请求头、当前密码和 `confirm: DELETE`，复用现有账号清理服务。不接受 body UID 作为账号身份，不返回 refresh token。

删除票据以 Redis GET/DEL 原子消费，阻止重复提交；删除失败也需要重新登录后重试，页面不会把部分清理视作成功。Native token 接口继续拒绝浏览器请求。真实账号仅用于登录 / 读取验证，不用于删除回归。
