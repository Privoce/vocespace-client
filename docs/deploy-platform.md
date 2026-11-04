# Deploy 发布平台

`apps/deploy` 是独立子项目 `@vocespace/deploy`，监听 **4848**。管理 Web、Server（现有 `services/api`）和 Platform（`apps/platform`），不参与根 `pnpm build` 的 Web/API 构建，不由平台发布自身或 Mobile。

## 首次启动

先按 [Ubuntu 部署](../linux_deploy.md) 准备 Node 24.12.0 / pnpm 10.27.0、PM2 和 `/var/vocespace/main`，完成 `init` 并填写 `api-data/vocespace.conf.json`。平台与现有发布脚本必须使用同一 Linux 用户、同一 PM2 环境。源码目录应位于部署目录之外。

```bash
cd /root/vocespace/vocespac-client
source /var/vocespace/main/tools/env.sh
pnpm install --frozen-lockfile
pnpm build:deploy
pnpm start:deploy --root /var/vocespace/main
```

访问 `http://服务器地址:4848`，输入这份配置中的 `hostToken`。默认监听 `0.0.0.0`；只通过已有 HTTPS 代理访问时，可加 `--host 127.0.0.1`。平台不自动修改 Caddy、防火墙或其他服务。

生产环境用 PM2 常驻（不要同时运行上面的前台服务）：

```bash
cd /root/vocespace/vocespac-client
source /var/vocespace/main/tools/env.sh
pm2 start apps/deploy/server/index.mjs \
  --name vocespace-deploy \
  --interpreter "$(command -v node)" \
  -- --root /var/vocespace/main
pm2 save
```

默认源码位置是平台所在的 monorepo 根目录；需要管理另一个 checkout 时，可在启动参数中指定 `--source /绝对路径`。这些路径只在服务器启动时配置，页面不能修改或提交脚本路径。平台不从 `.env` 读取业务配置；鉴权固定读取 `ROOT/api-data/vocespace.conf.json`。

## 操作流程

| 操作 | 行为 |
| --- | --- |
| 创建发布 | 选择 Web / Server / Platform，输入新版本名，使用当前源码构建并自动激活 |
| 更新发布 | 检查源码无未提交修改，执行当前分支 `git pull --ff-only`，再构建、激活新版本 |
| 回滚 | 在版本记录中选择已完成的历史版本，只切换对应项目 |
| 删除旧版本 | 删除该 release 的文件；当前版本、保留的 previous 版本和 PM2 引用的版本均禁止删除 |
| 操作日志 | 自动刷新任务输出，可切换历史任务查看结果；浏览器刷新不终止任务 |

点击“开始发布”即执行构建和上线，不另设审批步骤。回滚与删除有目标版本确认。版本名最多 80 个字符，只支持字母、数字、点、横线和下划线，以字母或数字开头，例如 `web-002`、`api-002`、`platform-002`；版本名不可重复使用。每次只发布一个项目，其他服务保持当前版本。共享接口不兼容变更仍应使用命令行双项发布流程。

更新只拉取已有当前分支和 upstream，不切分支、不 reset、不 stash。需要交互输入 Git 密码的操作会失败并显示日志，因此应先在服务器配置好仓库访问。新的源码可以包含平台本身的修改，但 Web/Server/Platform 发布不会自动重建或重启 `vocespace-deploy`；更新平台本身时单独运行 `pnpm build:deploy` 和 `pm2 restart vocespace-deploy`。

## 任务与版本记录

平台复用 `scripts/ubuntu/deploy.sh` 的构建、预检、PM2 单实例切换、备份、健康检查和失败恢复。全流程持有同一个 `ROOT/.deploy.lock`，覆盖拉取、构建、激活或删除；与 CLI 发布互斥。通过已验证指向相同文件的继承 fd 9 复用锁，不用环境变量绕过锁检查。

平台服务与后台任务进程分开，重启页面服务不主动终止正在执行的任务。每次操作有独立任务 ID，状态和脱敏日志保存在：

```text
ROOT/deploy-platform/active.json
ROOT/deploy-platform/jobs/<id>.json
ROOT/deploy-platform/jobs/<id>.log
ROOT/.deploy-state.json              # Web/API/Platform 当前与回退版本，沿用原脚本
```

重启后仍存活的任务继续显示；已退出但没有终态的任务记为“已中断”，不自动重试。若 worker 意外退出而子命令仍执行，子命令仍持有部署锁；后续任务会失败退出而不是并行切换。遇到中断先检查日志、PM2 和 `deploy.sh status` 再操作。

平台历史列表展示最近 100 项，页面显示所选日志最后 128 KiB；每个任务磁盘日志最多 8 MiB，到上限后停止追加输出但保留最终任务状态。任务日志不随 release 删除。旧日志可由部署管理员在确认任务结束后按需归档。

鉴权沿用 Dashboard 的 `hostToken` 等长常量时间比较规则，平台独立读取配置，因此业务 API 停机时仍可登录操作。浏览器仅持有随机 HttpOnly / SameSite Cookie，8 小时过期，不保存 hostToken 到 localStorage 或 URL。登出、平台重启或检测到 token 变化使会话失效。接口检查同站来源和 JSON 输入；未登录不能读取版本/日志或执行操作。

## 验证范围

- `pnpm build:deploy`：检查 Node 服务语法并打包独立前端资源，不改 Web 的 `.next`。
- `pnpm test:deploy`：10 项隔离测试覆盖鉴权/过期/配置轮换、跨站与参数校验、版本删除保护、回滚产物验证、任务互斥/重启记录、日志脱敏、构建失败停止激活、真实子进程输出、独立 worker 和 fd 传递。
- 21 项 Ubuntu 部署脚本测试、127 项单元/Hook 测试、根/API 类型、模块边界和 JSON 部署检查通过。Platform 另有生产启动/代理检查。
- 浏览器使用独立测试数据验证登录、创建/更新模式、版本保护入口及日志呈现；不代表真实版本已经上线。
- 未在 Ubuntu 实机执行 Git 拉取、真实 flock 竞争、生产 PM2 切换和回滚。自动测试使用假 Git/PM2/flock 或注入命令执行器，不访问生产服务。


## Platform 账号门户

`Platform` 是从独立 `vocespace_platform` 迁入的账号门户，和本 Deploy 管理工具是两个项目。
部署前设置 `deployment.platform`，默认监听 `127.0.0.1:3002`，使用统一 API 与现有 Supabase。
首次部署先升级 API，再在本页面选择 **Platform → 创建发布**。配置、代理域名、OAuth 回调和 CLI 示例见
[Platform 迁移说明](platform-migration.md)。旧 Web/API 版本记录仍兼容；没有 Platform 记录时显示未部署。
