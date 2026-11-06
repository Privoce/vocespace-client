# 2026-11-05 服务器部署记录

用户授权在 `144.202.27.247` 更新 Web/API，迁入 Platform，安装 Deploy，并开启 RDS 埋点；Deploy 选择 `deploy.vocespace.com`，DNS 由用户稍后配置。

## 来源与备份

- 本机与服务器均先执行 `git fetch origin feature/rebuild`；服务器源码 `/root/vocespace/vocespac-client` 从 `main` 切到跟踪 `origin/feature/rebuild`，基线为 `1137ff1`。
- 原源码目录 `.env` 保留，加入服务器本地 `.git/info/exclude`，没有将旧环境变量导入业务配置。
- 唯一业务配置：`/var/vocespace/main/api-data/vocespace.conf.json`。只开启 `analytics.enabled`，保留现有 `https://rds.vocespace.com` 和 Website ID；增加 `deployment.platform`：本机 3002、API 上游 `http://127.0.0.1:3001`、公开 Origin `https://home.vocespace.com`。
- 原配置、Caddy、PM2 登记与版本状态保存在服务器 `/var/vocespace/main/backups/deploy-20261105-1137ff1.g9USQy/`，权限限制在部署用户。部署脚本在 API 停止后另做本地数据备份；不清空或回滚 Redis。

## 构建修复

隔离 Platform 构建失败于 `/auth/callback`：Next 14 尝试预渲染 GET 路由，读取 release 根目录不存在的生产配置。本机有 JSON 时未暴露这个问题。

对 OAuth callback 和邮件 confirm 路由显式添加 `dynamic = 'force-dynamic'`，配置和会话只在请求时处理。补丁同步到本地与服务器源码，尚未提交/推送 Git；补丁副本在备份目录的 `platform-callback-runtime.patch`。发布目录仍不复制生产配置和密钥。首次失败目录保留供诊断，不激活。

注意：在补丁提交到 `feature/rebuild` 并同步服务器前，Deploy 的“更新发布”会因源码修改而拒绝拉取。不要直接丢弃补丁；应先确认远端已包含同样修复，再清理这两处服务器本地修改并快进同步。创建发布仍可使用当前修复源码。

## 已部署状态

| 服务 | PM2 | 版本 / 来源 | 监听 |
| --- | --- | --- | --- |
| Web | vocespace-web | web-api-20261105-1137ff1 | 127.0.0.1:3000 |
| API | vocespace-api | web-api-20261105-1137ff1 | 0.0.0.0:3001（沿用） |
| Platform | vocespace-platform | platform-20261105-1137ff1-fix1 | 127.0.0.1:3002 |
| Deploy | vocespace-deploy | 源码目录 apps/deploy，1137ff1 | 127.0.0.1:4848 |

四个新进程在线，检查时重启次数均为 0；PM2 状态已保存，`pm2-root` 开机服务已启用。旧 `platform` PM2 登记保留但已停止，3099 不再监听；其他应用保持原状。

Caddy 只将 `home.vocespace.com` 上游从 3099 切到 3002，并增加 `deploy.vocespace.com` → 4848；静态首页、LiveKit/Egress、旧 3060 规则和其他域名未改。候选配置校验及 reload 通过。

停止旧 API 后的本地数据备份：`/var/vocespace/main/backups/20261104T170700Z.5JcU0u/api-data.tar.gz`（目录名使用 UTC，用户时区为 11 月 5 日）。Web 的 previous 为 `web-002`，API 的 previous 为 `release-001`；Platform 首次纳入发布脚本，previous 为空。

## 验证结果

- 本机 21 项部署脚本测试、10 项 Deploy 测试通过；回调修复的 Platform 类型检查通过。
- 服务器完成隔离 Web/API、修复后 Platform 和 Deploy 生产构建，保留已有 lint/版本导入警告。Platform 生产启动/资源/代理/协议路由 smoke 通过。仓库忽略 `*.test.*`，因此该 smoke 文件从本机显式复制到 release 的测试目录后执行，不含生产凭证。
- 三个服务 `/healthz` 均 200；公网 Origin 检查、昵称检查、Dashboard 无令牌刷新均 200；Engine.IO polling 200、WebSocket Upgrade 101。
- 新账号门户登录和两份协议 200；Google 按钮在未勾选协议时可点击。公开在线目录 200，检查时返回 1 个在线 Space。
- 真实浏览器发现页显示 331 张合并卡片，无失败提示；Supabase 单独只读查询有 341 条公开记录。浏览器登录/发现/Dashboard 未发现控制台错误。
- Dashboard 下发的 `analytics.enabled=true`，浏览器加载实际 RDS 脚本；`script.js` 返回 200。另发送一次不含账号、房间名或凭据的 `deployment_verification` 测试事件，`/api/send` 返回 200；未直接查询统计数据库，不将 HTTP 成功当成入库审计。
- Deploy 本机页面 200、未登录状态接口 401、实际 hostToken 登录与三个项目状态读取 200，测试会话随后登出。通过 SSH 隧道检查登录页面呈现正常；管理端口没有直接暴露公网。
- 生产配置前后差异确认只有 `analytics.enabled` 和新增 `deployment.platform`。

具体日志、补丁和 `verification.json` / `rds-verification.json` 位于第一节备份目录。未进行真实注册邮件、OAuth 登录、媒体发布或 Egress/HLS 播放验收。

## 尚需 DNS

按用户决定，Deploy 公网 DNS 稍后处理。添加 `deploy.vocespace.com` 的 A 记录到 `144.202.27.247`（先仅 DNS）。服务器上的路由已配置，HTTP Host 路由返回 308；证书签发及公网 HTTPS 尚未验收，DNS 生效后需要复查。

Web/API 如需回退，使用当前源码中的 `bash scripts/ubuntu/deploy.sh rollback /var/vocespace/main`；不会回滚数据或配置。旧 Platform 回退需手动恢复原 PM2 `platform` 进程及 home 域名的 3099 上游，不能调用尚无 previous 的 Platform 自动回退。以上均为恢复说明，本次没有执行回退。

