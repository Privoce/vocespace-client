# Platform 账号、发现与协议对齐

## 账号流程

Platform 保留浏览器 Supabase SDK / Cookie 会话，与 Mobile 使用同一个 Supabase 项目及注册、验证码、恢复语义：

- 登录：邮箱 + 密码；注册：密码至少 8 位，先发送邮箱验证码，再用六位 `signup` 验证码完成注册登录。首次 `/signup`、重发 `/resend`；发送后锁定密码，修改邮箱清空验证码。重复提交被阻止，重发间隔 60 秒。
- 忘记密码：发送 `recovery` 验证码，输入六位码及两次新密码，验证成功后更新密码并回到登录。使用不持久化、不自动刷新、不读取 URL 会话的独立 Supabase 客户端，结束清理恢复会话，不把临时恢复凭据装入常规浏览器登录会话。
- 邮箱登录和注册要求主动勾选协议；默认不勾选。按用户最新要求，Google 登录可直接点击，无需勾选协议，仍保留请求期间防重复提交；找回密码也不受勾选条件限制。保留登录后的资料完善及入会跳转。
- 未开放 Native token 路由给浏览器，也没有新增服务器密码转发层；现有 Native Origin 拒绝规则不变。

Supabase 部署要求与 [Mobile 账号说明](supabase-account-auth.md) 一致：开启邮箱确认、邮件 OTP 长度 6 位，Confirm signup 与 Reset password 模板展示 `{{ .Token }}`。Google 继续使用 Platform `/auth/callback` 的允许重定向 URL。旧确认链接保留兼容入口，新 UI 的密码恢复使用验证码。未修改远端 SMTP、模板或 Auth 配置；真实邮件送达/验证码消费/OAuth 回跳需使用测试账户回归。

## 发现数据

原实现先等待在线 API；任何非 200 响应都会直接结束，导致 Supabase 的 Space 不再读取。现在两路独立请求：

1. Supabase `space` 表，仅查询 `public = true`，沿用浏览器用户会话与 RLS，不使用 service role 扩大可见性。
2. 同站 `GET /api/platform/spaces`，不依赖浏览器账号恢复。统一 API 从 LiveKit 当前房间读取候选，再结合 Redis Space 公开策略及在线成员过滤；不会用历史 Redis Space 充当在线房间。

按会议 URL 合并去重，保留数据库介绍/图片/订阅人数，实时在线人数和活跃状态来自在线目录。支持旧 JSON 字符串和原生 JSONB 的 `freq`、`images`。一路失败保留另一路，显示具体来源失败与重试；两路失败不伪装成“暂无空间”，请求超时/组件离开会取消请求。

本机只读验证 Supabase 返回 341 条公开记录，浏览器按 URL 去重显示 330 张卡片。现有 API 进程仍运行旧 Platform 路由，曾返回 `ORIGIN_DENIED`；本次重启本机 API 加载当前构建后，同站在线列表返回 200 / 空数组，浏览器无失败提示。此时没有在线房间，不代表真实在线会议/Egress 已回归；生产部署仍需同时发布新 API。

## 协议

复用用户此前提供的 2026-10-26 版英文协议，正文无修改；唯一数据源移到 `packages/i18n/src/legal-documents.ts`，UI 包保留兼容导出。Platform 的 React 18 DOM 阅读器不引入 React 19/RN 组件。i18n 仍只包含纯文案，不增加平台副作用。

首页、登录/注册/找回页均提供入口。`/policy/terms` 正确展示用户协议，`/policy/privacy` 展示隐私政策，旧 `/policy/teams` 重定向到 terms，未知类型 404。支持表格、段落锚点、删除账户/AI 条款链接及跨协议跳转。正文继续保留现有英文原文，中文界面标签不代表正文已翻译。

## 验证

- 全量 Vitest 138 项通过，含新增账号适配器和目录行为 11 项；独立 React 18 表单回归 6 项（`pnpm test:platform:auth`），验证协议门槛、发码去重/冷却、邮箱变更、恢复密码及卸载竞态。
- 根/API/Platform/UI/Mobile 类型、模块边界、API 构建和部署配置检查通过。Platform 标准生产构建与实际生产服务启动/代理/协议路由 smoke 通过；lint 无错误，保留迁入代码的已有警告。
- 浏览器检查登录默认状态、注册验证码字段、找回页面、两份协议及真实公开发现列表；没有触发真实邮件、注册、改密码或 OAuth。未部署生产服务器，未进行手机真机回归。
