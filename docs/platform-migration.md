# Platform 前端迁入 Monorepo

账号验证码、发现列表和协议的后续修复见 [对齐说明](platform-auth-discovery.md)。本机 API 已在该次修复中重启加载新路由。

## 目录与接口

原 `/Users/shengyifei/projects/livekit/vocespace_platform` 的页面、组件、样式、资源及浏览器数据适配器迁入 `apps/platform`，工作区名 `@vocespace/platform`。原目录未修改或删除。未复制 `.git`、`.env*`、secret、依赖或构建产物。中英词典归 `packages/i18n` 的 `platform_*` 子路径。

- 原首页/空间、账号登录与资料、待办、AI 历史及隐私页面保留。浏览器 Supabase SDK 继续使用用户会话及既有 RLS，未更改数据库或存储桶策略。
- Next 仅处理 Supabase 登录/邮件回调。新 API `GET /api/platform/spaces` 复用 LiveKit + Redis 公开在线目录；私密房间与 Redis 残留记录不作为在线房间返回。原 Supabase 公开空间目录仍可展示已发布的介绍信息；没有介绍记录的在线卡片直接进入会议。
- `POST /api/platform/create` 与 `/entry` 验证 Supabase access token。创建原子写 Redis，并从已验证账号确定 ownerId；进入会议签发 60 秒一次性 code，跳转到配置中的会议地址。前端提供的 UID、角色和任意跳转域名不受信任。
- 会中 `/api/platform`、待办与 AI 同步改由统一 API 访问现有 Supabase，移除对旧 `home.vocespace.com/api` 服务的依赖。账号数据写入绑定会话身份，房间管理权限不赋予他人账号数据写权限。
- 账号删除进入现有会议 Web 的 `/deleteAccount` 流程，复用现有验证及删除实现。迁移未新建账户系统、数据库表或数据副本。

## 配置与本机启动

业务配置仍只在 `vocespace.conf.json`。新增项的默认值如下（合并进已有 `deployment`，不要覆盖其他配置）：

```json
{
  "deployment": {
    "platform": {
      "host": "127.0.0.1",
      "port": 3002,
      "apiUrl": "http://127.0.0.1:3001",
      "publicOrigin": "http://localhost:3002"
    }
  }
}
```

会议 Web 的登录、个人中心和 AI 历史入口也读取 Platform Origin，已移除写死的旧门户域名。`deployment.publicOrigin` + `basePath` 仍指向会议 Web；`deployment.platform.publicOrigin` 是账号门户自己的外部 Origin。`apiUrl` 指向同一部署的统一 API，可使用内部地址，不必经过公网。浏览器只请求 Platform 同站 `/api/platform/*`，由服务端代理，避免跨站 Cookie 和 CORS 问题。Platform 当前部署在独立域名根路径。

账号沿用 `account.supabase.url`、`publishableKey`、`serviceRoleKey`。浏览器仅获得 URL、publishableKey 和会议 URL；serviceRoleKey、hostToken、LiveKit/SMTP 等配置不进入浏览器。服务端私有同步需要 serviceRoleKey；为空时返回配置不可用，不伪造成功。

```bash
pnpm install --frozen-lockfile
pnpm dev:api
# 另一个终端
pnpm dev:platform
```

打开 `http://localhost:3002`；进入会议还需 `pnpm dev:web`。生产构建使用 `pnpm build:platform`，启动使用 `pnpm start:platform`。构建不绑定 Supabase 环境变量，运行时读取 JSON 的公开投影。

在 Supabase Auth 的 Redirect URLs 中保留/增加实际 Platform 域名的 `/auth/callback`、`/auth/confirm` 及找回密码流程所需回调。本机测试需允许 `http://localhost:3002` 对应路径。继续使用原域名时保留原配置；改域名后旧域名的浏览器登录 Cookie 不会自动迁移。

## Deploy 与 Ubuntu 发布

Deploy 页面新增 **Platform** 服务卡片与发布项目选项，可创建、更新、回滚和清理版本；其 PM2 进程为 `vocespace-platform`。首次上线先发布本次统一 API，再发布 Platform。Web/API/Platform 独立记录 current/previous；旧版本状态兼容，未部署的 Platform 显示空状态。

```bash
bash scripts/ubuntu/deploy.sh build /var/vocespace/main platform-001 -p platform
bash scripts/ubuntu/deploy.sh activate /var/vocespace/main platform-001 -p platform
bash scripts/ubuntu/deploy.sh status /var/vocespace/main -p platform
# 需要回退时
bash scripts/ubuntu/deploy.sh rollback /var/vocespace/main -p platform
```

`-p @vocespace/platform` 同样可用。为兼容已有部署，`all` 仍表示 Web + API；Platform 显式选择。Platform 构建复制自身与依赖工作区，安装锁定依赖；激活只切换 Platform，不暂停其他服务或备份/覆盖业务数据。健康检查失败恢复原进程及版本指针。

服务器固定 JSON 中将 `deployment.platform.publicOrigin` 改为实际域名，例如 `https://home.vocespace.com`，将 `apiUrl` 端口对齐服务器 API。反向代理示例：

```caddyfile
home.vocespace.com {
  reverse_proxy 127.0.0.1:3002
}
```

切换前保留原平台服务及回退方式，确认页面、登录回调、会议入口、资料/待办/AI 历史后再停用旧项目。此迁移不自动修改生产代理或部署真实服务器。

## 验证边界

本次通过 127 项 Vitest、21 项 Ubuntu 部署脚本测试、10 项 Deploy 测试。`pnpm test:platform` 在生产构建后启动真实 Platform 进程，使用临时 JSON 和假 API，验证从仓库根目录启动、Ant Design 5 SSR、静态资源、私有配置隔离、代理请求头/状态码及旧业务路由已移除。

根/API/Platform 类型、导入边界、Platform/API/Deploy 构建、JSON 部署检查通过；Web 改动模块 lint 无错误（保留原有警告）。浏览器验证首页到登录页导航及依赖隔离后的登录页呈现，无 hydration 错误。未重启既有本机 Web/API，也未覆盖运行中的 Web 构建目录进行完整生产构建；测试启动的 Platform 进程已结束。加载新接口需要重启 API。

测试使用假凭证、临时目录和模拟存储，不发送真实邮件或写入用户数据库。

真实 Supabase Google/邮件回调、现有 RLS/存储桶策略与生产 Ubuntu/PM2 切换仍需部署后回归。保留原前端的已有功能范围；例如旧 `/space/[spaceId]/edit` 独立页面仍是原占位入口，本次没有扩展该编辑器。
