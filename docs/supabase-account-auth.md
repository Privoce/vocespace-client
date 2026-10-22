# Supabase 账号接入（2026-10-22）

## 本次范围

沿用 `vocespace_platform` 的 Supabase 项目和账号，不新建用户库。Mobile 登录/注册表单、忘记密码、我的页面退出登录与注销账号调用独立 API；删除了原演示账号校验及公开 env 密码。已有平台账号可直接使用；新注册账号按 Supabase 项目的邮箱确认配置处理，未确认时不伪装登录成功。新的密码至少 8 位，旧平台密码仍可用于登录。

账号 DTO 位于 contracts，验证/删除顺序位于 server-core，HTTP 客户端位于 client-sdk，Supabase REST 与 Redis 适配在 `services/api/account`。不把旧 Next 平台路由搬进客户端，也不引入第二份账号数据库。读取旧 `user_info.nickname/username` 显示昵称；无资料的新用户使用邮箱前缀，旧平台的资料完善流程保持独立。

本次不是 Space 所有权迁移：Supabase 账号令牌与现有 Native RTC 会话分离，登录不自动获得房主、录制、部署管理或发布权限。我的页面关注、会员、历史等仍是此前 UI 原型；资料编辑尚未写回平台。Google OAuth 没有接入，Gmail 图标仍沿用原 UI 占位提示。Web 现有平台登录入口保持原行为，新增 Web 页面仅承接邮件确认和密码重置。

## API 与凭证

全部路径以 `/api/v1/account/` 开头；除 callback 外均为 JSON POST。

| 路径 | 输入 / 授权 | 结果 |
| --- | --- | --- |
| login | email、password | accessToken、refreshToken、expiresAt、user |
| register | email、password | session 或 confirmationRequired |
| refresh | refreshToken | 轮换后的 session |
| me | Bearer accessToken | Supabase 验证后的用户及已有平台昵称 |
| logout | Bearer accessToken | 撤销当前 Supabase 会话 |
| forgot-password | email | 统一成功结果，不返回账号是否存在 |
| callback（GET） | 一次性 state、code | 固定站点内跳转，无长期 token 查询参数 |
| reset-password | 同站 Origin、X-Vocespace-Request: 1、HttpOnly 恢复 Cookie、password | 更新密码，消费恢复凭证 |
| delete | Bearer accessToken、当前 password、confirm: DELETE | 清理全部已确认平台数据后删除 Auth 用户 |

令牌接口拒绝浏览器 Origin / Sec-Fetch-Site，Native 不使用浏览器 Cookie。access/refresh token 只保存到 API 地址隔离的 Expo SecureStore，密码不持久化；未选“记住我”时仅保留内存会话。冷启动/前台恢复验证用户并按需刷新，网络错误保留可恢复的存储凭证，失效凭证退出登录。昵称和客户端传入 UID 不作为删除授权来源。

注册/恢复邮件使用 PKCE：Redis `v1:account-flow:<随机 state>` 保存 verifier 和类型，最长 1 小时；code 兑换后只在恢复流程签发 10 分钟、一次性 HttpOnly Cookie。密码重置不需要 App 跳转协议，用户在浏览器完成后返回 App 登录。邮件校验码仍受 Supabase 自身有效期限制。密码更新失败时恢复凭证已消费，需要重新申请邮件。

Redis `v1:account-rate:*` 提供认证动作的分钟计数（全局 200 次、同动作/账号或凭证哈希 10 次）；Redis 不可用时失败关闭。请求体上限 20 KB；Supabase 请求超时 15 秒；返回稳定错误码，不泄漏上游报错或密钥。

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

如部署有子路径，回调与 ACCOUNT_PUBLIC_URL 一并带上。API 仅在开发模式允许 localhost 的 HTTP。邮件必须使用 Supabase 的确认链接模板，确保保留 RedirectTo/code 回调；确认 Email provider 开启、注册开关和邮箱确认策略符合需求，并配置可向测试邮箱发送邮件的 SMTP。Supabase 默认邮件服务对收件人/速率有限制，不能仅凭 API 成功判定邮件已投递。参见 [密码认证说明](https://supabase.com/docs/guides/auth/passwords) 和 [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)。

本机已从旧平台复制三个必要 Supabase 配置到被 Git 忽略的 `services/api/.env.local`（权限 0600），未输出密钥；回调默认 `http://localhost:3000`。如果邮件在真机上打开，应改成真机可访问的 HTTPS Web 地址，并同步 Supabase allowlist。没有修改线上 Supabase 设置。重启 `pnpm dev:api`，重新加载 App；重置页还需要 Web 正常运行。此变更未增加原生依赖。

## 验证与待回归

认证专项测试覆盖输入校验、邮箱确认、过期刷新、存储失败、删除重认证/身份不匹配、分页文件清理、失败停止、Native 传输限制、限流、PKCE 单次回调、恢复 Cookie 与 CSRF 拒绝。所有依赖使用隔离模拟，不发真实邮件、不修改远程账号。

真实验收仍需要：旧账号登录/重启恢复、新邮箱注册确认、邮件重置后新密码登录、专用测试账号创建各类旧平台数据并确认注销清空，及 iOS/Android 真机 Keychain 行为。未完成这些验证前不标为生产账号流程已验收。

本批自动结果：241 项 Vitest（47 文件，其中认证专项 24 项）、187 项隔离 HTTP/Redis/Socket 检查通过；根/API/Mobile/UI 类型、边界、相关 lint、安装检查、Compose config、iOS/Android JS 导出通过。标准 `pnpm build` 在 /tmp 独立依赖副本通过（保留既有 Hook/img lint 警告），没有覆盖正在运行的 Web 构建目录。JS 导出不代表原生编译或真机通过。
