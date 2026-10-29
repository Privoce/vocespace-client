# VoceSpace Linux 部署与升级

更新：2026-10-27。按现有服务器的 **源码构建 + PM2 + Caddy** 方式部署，沿用 `vocespace.com`、静态首页、3060 服务、LiveKit / Egress / Redis / Supabase。当前 Web 与 API 必须分别启动，Web 不再拉起 API 子进程。

```
bash scripts/ubuntu/setup.sh /var/vocespace
source /var/vocespace/tools/env.sh
bash scripts/ubuntu/deploy.sh init /var/vocespace
```

## Ubuntu 自动部署脚本（2026-10-29）

推荐使用本节脚本，替代下方手动安装、构建、PM2 切换步骤。**脚本不读写或 reload Caddy，不操作 LiveKit / Egress、3060 服务或 Redis 服务配置。** 第 6 节是之前保留的 Caddy 路由参考；已有路由正确时无需执行。默认 Web `3030`、API `3031`，与原部署方案一致。

脚本在 `scripts/ubuntu/`：

- `setup.sh`：为 Ubuntu x64 / arm64 安装编译工具、redis-cli、仓库指定的 Node / pnpm；缺少 PM2 时安装 PM2 6。Node 官方压缩包经 SHA-256 校验后装入部署目录，不替换系统 Node。
- `deploy.sh init`：创建目录及 API 环境模板；已有环境文件与数据保持原样。
- `deploy.sh build`：从当前源码复制构建输入到全新的 release，独立安装依赖并执行标准构建、架构边界及数据初始化检查。排除本地环境文件、数据、密钥文件、node_modules 和旧构建产物。
- `deploy.sh activate`：检查配置与进程归属，停止本脚本管理的两个进程，备份文件及 Redis，顺序启动 API / Web 并检查健康状态。失败时尝试恢复旧进程，不自动恢复数据库。
- `deploy.sh rollback` / `status`：回退到上一个成功版本 / 查看进程及本机健康状态。

### 首次准备

上传或检出完整 monorepo 到源码目录（示例 `/var/vocespace/source`），使用**普通部署用户**操作；不要 `sudo bash deploy.sh` 或 `sudo pm2`。如果已有 Node / pnpm / PM2，版本满足 `.nvmrc` / `packageManager`，且有 `rsync`、`flock`、`curl`、`tar`、`redis-cli`，可跳过 setup。

```bash
cd /var/vocespace/source
bash scripts/ubuntu/setup.sh /var/vocespace
source /var/vocespace/tools/env.sh
bash scripts/ubuntu/deploy.sh init /var/vocespace
nano /var/vocespace/api-data/.env.production
chmod 600 /var/vocespace/api-data/.env.production
```

setup 只在安装系统包、创建尚不存在的部署根目录时调用 sudo。已有 `/var/vocespace` 必须可由部署用户写入；脚本不会递归修改静态首页等既有目录的所有者。它不安装 Redis 服务端；沿用现有 Redis、LiveKit、Egress 和 Supabase。

在模板里填写真实 Supabase 项目 URL、publishable / anon key、service role key，以及公共 origin。**旧部署必须保留原 `vocespace.conf.json`、uploads、sql、lib/uploads 和对应 Redis，不能开启首次初始化替代迁移。** 全新部署才取消模板里的 `VOCESPACE_INIT_CONFIG=true` 等注释，填写 LiveKit / Redis / host token；已有配置中的 Redis / LiveKit 参数不会被环境变量改写。

### 构建与首次切换

```bash
# 从当前源码目录运行；支持未提交源码，但不会自动 git pull 或 checkout。
bash scripts/ubuntu/deploy.sh build /var/vocespace 20261029-1
```

目录最终如下。构建需要完整开发依赖与足够内存（Web 构建允许 8 GB Node 堆），不要设置生产依赖裁剪安装。

```text
/var/vocespace/
  source/                        # 上传/检出的源码，继续在这里更新
  tools/env.sh                   # 在新终端 source，选用部署 Node
  api-data/.env.production       # 只有 API 读取；权限 600
  api-data/vocespace.conf.json   # 原业务配置
  api-data/uploads/              # 原数据
  releases/20261029-1/           # 独立源码、依赖、产物、ecosystem.config.cjs
  backups/<时间>/                # API tar 包、Redis RDB，保留供人工恢复
  current -> releases/...        # 健康检查通过后更新
  previous -> releases/...       # 上一个成功版本
```

**从旧手工部署迁移的首次维护窗口：** 先记录旧 PM2 名称、源码路径及启动配置，按第 3 / 9 节停止实际旧 VoceSpace 写入者，备份并迁移数据到 `api-data`。如果旧进程也叫 `vocespace-api` / `vocespace-web`，在确认已停止及备份后删除这两个旧登记。脚本遇到同名但非本脚本管理的进程，或端口被其他应用占用，会停止并报错，不自动接管。不要停止 3060 或其他业务；旧组合服务不能继续写入同一数据。首次迁移失败时需要用记录的旧配置手工恢复，只有已有 `current` 的后续升级能自动回退进程。

```bash
bash scripts/ubuntu/deploy.sh activate /var/vocespace 20261029-1
bash scripts/ubuntu/deploy.sh status /var/vocespace
pm2 logs vocespace-api --lines 60 --nostream
pm2 logs vocespace-web --lines 60 --nostream

# 首次配置开机自启；执行 PM2 输出的那一条 sudo 命令。
pm2 startup
# activate 已执行 pm2 save；修改进程清单后需要再次保存。
pm2 save
```

在当前部署用户的 shell 中加载 `tools/env.sh` 后执行 startup，使其记录正确 Node 路径。Node 路径变更后重新生成开机服务。端口不同的部署可以在 **build 时** 指定 `WEB_PORT=... API_PORT=...`，`NEXT_PUBLIC_BASE_PATH` 也在 build 时指定并写进该版本 PM2 配置；activate 沿用版本内的值。默认部署域名根路径，不需要这些覆盖值。

### 自动备份与升级回退

每次 activate / rollback 都先检查配置，再停止管理中的两个进程，备份整个 `api-data` 到权限受限的目录。已有配置时，默认使用其 Redis host / port / password 通过 `redis-cli --rdb` 获取快照；密码通过子进程环境传入，不出现在命令行或输出。**RDB 包含该 Redis 实例的所有数据库，不只是 VoceSpace 的 DB**，要保密存放。备份不停止 Redis、不修改持久化设置，最长等待 5 分钟；失败会中止切换并尝试恢复旧进程。备份期间不要运行其他写同一业务数据的进程。

托管 Redis 禁止复制快照，或使用 TLS / ACL 等特殊连接方式时，提供可执行备份 hook：

```bash
REDIS_BACKUP_HOOK=/var/vocespace/backup-redis.sh \
  bash scripts/ubuntu/deploy.sh activate /var/vocespace 20261029-2
```

hook 在 API 停止后执行，参数依次为备份目录、API 数据目录。它必须等待供应方备份成功，并把快照文件或可恢复的快照 ID 保存到备份目录，成功退出 `0`，失败返回非 `0`。不要用空脚本跳过备份。外部 Supabase / 对象存储仍使用各自的备份策略。

```bash
# 更新 source 中的代码后，新建版本（已存在的 release 一律拒绝覆盖）：
source /var/vocespace/tools/env.sh
bash scripts/ubuntu/deploy.sh build /var/vocespace 20261029-2
bash scripts/ubuntu/deploy.sh activate /var/vocespace 20261029-2

# 需要回退时，先备份现有数据，再切回 previous 对应代码：
bash scripts/ubuntu/deploy.sh rollback /var/vocespace
```

脚本使用部署目录文件锁，防止同一部署目录同时构建 / 发布。API 固定单实例 fork，不使用 cluster reload。失败的 release、备份与历史版本不会自动删除；确认验收后自行制定保留周期，至少保留 current / previous 及其依赖、构建产物和使用的 Node。回退**仅切代码，不回滚业务数据**；数据结构不兼容或需要数据恢复时，按第 9 节人工处理。

健康检查只确认 API / Web 进程可响应，不能代替 Caddy 公网路由、账号服务、邮件、WebSocket、LiveKit / HLS 和真机验收。发布后继续执行第 10 节业务检查。本机使用 `pnpm test:deployment-scripts` 验证部署流程（模拟 PM2 / Redis / 健康响应），验证记录见 checklist；尚未在生产 Ubuntu 上实际发布。

## 1. 端口与路由

| 请求 | 目标 | 本次调整 |
| --- | --- | --- |
| `/` | `/var/vocespace/vocespace_com` 静态首页 | 保留，只匹配根路径 |
| `/local_deploy/*` | `/var/www/scripts` | 保留 |
| `/incubator` | `https://space.gpg.eco/incubator` | 保留跳转 |
| `/api/s3/*`、`/api/rooms/*`、`/api/license/*` | `127.0.0.1:3060` | 保留，优先于通用 API 路由 |
| `/twirp/*`、`/rtc*` | `127.0.0.1:7880` | 保留 LiveKit 信令 / 服务 API |
| 其他 `/api/*`、`/uploads/*` | `127.0.0.1:3031` | 新增独立 VoceSpace API |
| `/socket.io`、`/socket.io/*` | `127.0.0.1:3031` | 从 Web 3030 改为 API 3031 |
| 其余页面及资源 | `127.0.0.1:3030` | 保留 Web 端口 |

App 的 `EXPO_PUBLIC_API_URL` 使用 `https://vocespace.com`；`PUBLIC_ORIGIN` 和 `ACCOUNT_PUBLIC_URL` 同样使用该 origin。本例部署在域名根路径，`NEXT_PUBLIC_BASE_PATH` 留空。不要将 Native 的 `/api/native/rooms` 或 `/api/v1/native/rooms` 误转给 3060。

3030、3031、3060 和 Redis 不需要直接对公网开放。LiveKit 的媒体 TCP / UDP、TURN 端口沿用现有配置；Caddy 的 `/rtc` 反代只解决 HTTP / WebSocket 信令，不代替媒体端口配置。

## 2. 准备源码和运行环境

使用现有部署用户操作 PM2，避免混用普通用户与 `sudo pm2` 产生两套进程列表。Node 使用仓库 `.nvmrc` 的 **24.12.0**，pnpm 使用 **10.27.0**；保留已安装的 PM2。缺少工具时，在该用户的 Node 环境中安装：

```bash
# 已使用 nvm 时，在新版本源码目录运行：
nvm install
nvm use
npm install -g pnpm@10.27.0
# 仅尚未安装 PM2 时执行：
npm install -g pm2
node --version
pnpm --version
pm2 --version
```

建议将每次发布源码放到独立目录，避免构建正在运行的 Next `.next`：

```text
/var/vocespace/
  vocespace_com/                 # 原有静态首页，不移动
  releases/
    20261027-1/                  # 完整 monorepo 源码、本版本依赖及构建产物
    <下一个版本>/
  api-data/                     # 所有版本共用的业务数据与 API 环境文件
```

以下示例源码目录为 `/var/vocespace/releases/20261027-1`，由部署用户拥有。使用 Git checkout 指定提交或上传完整源码，保留 `pnpm-lock.yaml`、`patches/`、`packages/` 和所有 workspace；不要只复制 `apps/web`。当前本地未提交的修复必须先由发布者整理提交 / 上传，单独拉远程 main 不会自动获得它们。已有服务器不必为了本文示例改名，替换为实际目录即可。

## 3. 持久化配置与旧数据

先准备数据目录（以当前部署用户为所有者）：

```bash
sudo install -d -m 750 -o "$(id -un)" -g "$(id -gn)" /var/vocespace/api-data
```

旧部署迁移时，**停止旧应用写入并完成备份后**，将原数据复制到该目录，保留原文件和权限：

- `vocespace.conf.json`
- `uploads/`、`sql/`
- `lib/uploads/S3_clean.json`（若存在）
- 其他现有 API 数据文件、证书与授权配置（按实际部署保存）

旧数据通常在原仓库根目录。不要复制一个空配置覆盖它，也不要切换到空 Redis。本机源码运行时，现有 Redis 的 `127.0.0.1` 地址可以继续使用。迁移和升级均只允许一个 API / worker 写入同一份 Redis 和文件。

在 `/var/vocespace/api-data/.env.production` 创建配置文件，权限设置为 `600`。首次创建后用编辑器填写，不要重复覆盖已有文件：

```dotenv
PUBLIC_ORIGIN=https://vocespace.com
ACCOUNT_PUBLIC_URL=https://vocespace.com
NEXT_PUBLIC_BASE_PATH=

SUPABASE_URL=填写旧平台项目地址
SUPABASE_PUBLISHABLE_KEY=填写旧项目publishable或anon-key
SUPABASE_SERVICE_ROLE_KEY=填写旧项目service-role-key
PLATFORM_JWT_SECRET=保持与旧平台签发方一致
LICENSE_SECRET=使用授权功能时保留原值

PREVIEW_ENABLED=false
PREVIEW_RENDERER_BASE_URL=https://vocespace.com
PREVIEW_MAX_SOURCES=3
# 使用自建或兼容 S3 存储时，按现有部署填写：
# PREVIEW_S3_ENDPOINT=https://实际对象存储地址
```

```bash
chmod 600 /var/vocespace/api-data/.env.production
```

上面中文值都是占位说明；填写真实值后才能启动。API 设置 `VOCESPACE_DATA_DIR` 后，从该数据目录加载 `.env.local`、`.env.production`、`.env`，先加载的值优先；同时检查遗留 `.env.local`，避免覆盖新配置。PM2 显式注入的环境值优先于这些文件。

**配置来源：** Supabase、公共 origin 等读环境变量；LiveKit / Redis / SMTP / S3 等会议业务配置主要读数据目录内的 `vocespace.conf.json`。迁移时保留原文件及其中的凭据。API 的 service role / 管理密钥不要放进 Web、App 或 `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*`。

仅全新部署、没有旧配置时，在同一环境文件中额外填写以下值并启用首次初始化：

```dotenv
VOCESPACE_INIT_CONFIG=true
LIVEKIT_URL=wss://vocespace.com
LIVEKIT_API_KEY=填写现有LiveKit-key
LIVEKIT_API_SECRET=填写现有LiveKit-secret
HOST_TOKEN=填写随机强管理令牌
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=填写实际Redis密码
```

若 LiveKit 使用独立域名，则继续填原来的公开 WSS 地址。初始化只在 `vocespace.conf.json` 不存在时执行，成功后移除 `VOCESPACE_INIT_CONFIG=true`。上述 LiveKit / Redis 环境变量不会更新已有配置；不要删配置来强制初始化。预览在真实链路验证前保持关闭。

## 4. 源码构建

在新发布目录中执行，旧服务此时可继续运行：

```bash
cd /var/vocespace/releases/20261027-1
pnpm install --frozen-lockfile
NEXT_PUBLIC_BASE_PATH= pnpm build
```

`pnpm build` 依次构建 API 和 Web，不关闭类型检查或 lint。Web 构建脚本设置了 8 GB Node 堆上限，需要为构建预留资源；不能在正在运行的旧发布目录中执行它。

确认产物和入口存在：

```bash
test -f services/api/dist/api.cjs
test -f services/api/dist/default-config.cjs
test -f apps/web/.next/BUILD_ID
test -f services/api/start.mjs
test -f apps/web/server.js
```

源码部署保留完整依赖和 workspace，以下 PM2 直接使用这两个启动入口。不要直接执行 `services/api/dist/api.cjs`，否则会跳过 `start.mjs` 的环境加载、数据初始化和静态资源路径设置。Web 的 `.env.local` / `.env.production` 也应核对；本例不需要把 API 的秘密环境文件复制给 Web。

## 5. PM2 分别启动 API 和 Web

在本次发布目录根创建 `ecosystem.config.cjs`。仓库是 ESM，配置用 `.cjs` 导出；`__dirname` 绑定本次发布路径，升级时必须使用新发布目录中的配置。`interpreter` 使用运行 PM2 命令的 Node 路径，先确认该命令在 Node 24.12.0 环境下执行。

```js
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'vocespace-api',
      cwd: __dirname,
      script: path.join(__dirname, 'services/api/start.mjs'),
      interpreter: process.execPath,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      kill_timeout: 30000,
      time: true,
      env: {
        NODE_ENV: 'production',
        API_HOST: '127.0.0.1',
        API_PORT: '3031',
        VOCESPACE_DATA_DIR: '/var/vocespace/api-data',
        WORKER_ENABLED: 'true',
      },
    },
    {
      name: 'vocespace-web',
      cwd: path.join(__dirname, 'apps/web'),
      script: path.join(__dirname, 'apps/web/server.js'),
      interpreter: process.execPath,
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      kill_timeout: 30000,
      time: true,
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3030',
        VOCESPACE_API_URL: 'http://127.0.0.1:3031',
        NEXT_PUBLIC_BASE_PATH: '',
      },
    },
  ],
};
```

配置字段与按名称启动方式见 [PM2 Ecosystem 文档](https://pm2.keymetrics.io/docs/usage/application-declaration/)。API 固定为单实例 fork，不使用 cluster / `-i max`；不要同时运行旧组合服务和新 API。

进入维护窗口，先用 `pm2 list` / `pm2 describe <旧应用名>` 确认旧应用及启动目录，停止它并按第 3 节备份 / 迁移数据。**仅操作实际旧 VoceSpace 应用，不执行 `pm2 stop all`，不要停止 3060、LiveKit 或其他业务。** 首次切换的新进程尚不存在时执行：

```bash
cd /var/vocespace/releases/20261027-1
pm2 start ecosystem.config.cjs --only vocespace-api
curl --fail http://127.0.0.1:3031/healthz
pm2 start ecosystem.config.cjs --only vocespace-web
curl --fail http://127.0.0.1:3030/healthz
pm2 list
pm2 logs vocespace-api --lines 80 --nostream
pm2 logs vocespace-web --lines 80 --nostream
```

API / Web 健康检查失败时先查对应日志，修复后再切 Caddy。日志仅本机查看，分享前移除 token 和个人数据。如果旧应用已经使用这两个 PM2 名称，按第 9 节先删除已停止的旧进程登记，再启动新路径；不要在相同名称下再加一个实例。

Caddy 切换和验收通过后，删除已停止的旧 VoceSpace 进程登记（保留旧源码以便回退），保存当前进程列表：

```bash
pm2 save
pm2 startup
```

按 `pm2 startup` 输出执行其指定的 sudo 命令，使用相同部署用户和 Node 路径；若已有正确的开机服务可保留。Node 路径升级后重新生成开机服务，不能只改当前 shell。参见 [PM2 开机恢复说明](https://pm2.keymetrics.io/docs/usage/startup/)。

## 6. 对应现有站点的 Caddyfile

下面替换 `vocespace.com` 这一段，其余站点及全局配置保留。`route` 固定处理顺序，保证 3060 的专用接口先于通用 `/api/*`。参见 [Caddy route](https://caddyserver.com/docs/caddyfile/directives/route)。

```caddyfile
vocespace.com {
    @legacy_api path /api/s3 /api/s3/* /api/rooms /api/rooms/* /api/license /api/license/*
    @preflight method OPTIONS
    @livekit path /twirp/* /rtc*
    @vocespace_api path /api/* /uploads/* /socket.io /socket.io/*

    route {
        handle_path /local_deploy/* {
            root * /var/www/scripts
            file_server browse
        }

        redir /incubator https://space.gpg.eco/incubator

        handle @legacy_api {
            # 保留旧 3060 服务的 CORS 行为，仅作用于这三个路径族。
            header {
                Access-Control-Allow-Origin *
                Access-Control-Allow-Methods "GET, POST, OPTIONS"
                Access-Control-Allow-Headers "Content-Type, Authorization"
            }
            respond @preflight 204
            reverse_proxy 127.0.0.1:3060 {
                header_up X-Real-IP {remote_host}
            }
        }

        handle @livekit {
            reverse_proxy 127.0.0.1:7880 {
                header_up X-Real-IP {remote_host}
            }
        }

        handle @vocespace_api {
            # 不使用 handle_path：API、上传和 Socket 都需要保留原路径。
            reverse_proxy 127.0.0.1:3031 {
                header_up X-Real-IP {remote_host}
            }
        }

        handle / {
            root * /var/vocespace/vocespace_com
            try_files {path} /index.html
            file_server
        }

        handle {
            reverse_proxy 127.0.0.1:3030 {
                header_up X-Real-IP {remote_host}
            }
        }
    }
}
```

与旧配置的区别：

- Web 保留 3030，新 API 使用 3031；`/socket.io/*` 也由 API 持有。Web 自身仍配置 API upstream，支持 Next 内部转发。
- 3060、7880、脚本目录、跳转和静态首页保持原目标。首页只匹配 `/`，协议页、账号页和会议页会进入 Next。若静态首页依赖独立静态资源目录，需要按它的实际 URL 另外配置精确路由，避免与 Next 的 `/_next/*` 或公共资源冲突。
- 不再全站返回 `Access-Control-Allow-Origin: *` 或吞掉全部 OPTIONS。当前 API 校验浏览器同源请求；同域 Web 和 Native 原生请求不需要全站 CORS。保留的 3060 CORS 只兼容旧接口，不能据此认为新 API 已支持任意外站浏览器调用。
- Caddy 原生支持 WebSocket，并为 HTTP upstream 保留 Host、处理 `X-Forwarded-*`，因此不再手动设置 Upgrade / Connection 等重复头。保留原来的 `X-Real-IP`。参见 [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)。

将修改保存为候选文件 `/etc/caddy/Caddyfile.new`，包含服务器原有的其他站点；先验证再替换（路径按现有 Caddy 服务调整）：

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile.new
sudo caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile
sudo cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)"
sudo cp /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

reload 失败时查看 `journalctl -u caddy`，恢复刚才的配置备份并再次验证 / reload。此操作可能让现有 WebSocket 重连，放在维护窗口完成。

```bash
curl --fail https://vocespace.com/healthz
curl --fail -I https://vocespace.com/
curl --fail -I https://vocespace.com/legal/privacy
curl --fail -I https://vocespace.com/legal/terms
curl --fail -I https://vocespace.com/deleteAccount
curl --fail 'https://vocespace.com/socket.io/?EIO=4&transport=polling'
```

公网 `/healthz` 对应 Web；API 健康检查用本机 3031。Socket polling 应返回含 `sid` 的握手内容，还要在实际会议中确认 WebSocket 能升级。健康检查不证明 Supabase、媒体或上传成功。

## 7. 账号、头像与反馈

- 使用旧 Supabase 项目；启用邮箱确认，注册和 recovery 邮件使用 `{{ .Token }}`、6 位 OTP，并配置真实 SMTP。仅旧邮件链接兼容流程需要允许 `https://vocespace.com/api/v1/account/callback?state=*`。
- `user_info` 的用户 JWT / RLS 必须允许当前用户读取、插入自己的资料以及更新自己的 `nickname` / `avatar`。昵称不会修改唯一 username。新接口是 `POST /api/v1/account/profile`，API 与 App 配套更新。
- 头像通过已有 `avatars` bucket 与 `public/<uid>_*` 路径写入，用户只能操作自身文件；显示使用公开对象 URL，确认读取方式与旧平台一致。不要关闭整个数据库的 RLS。参考 [Supabase Storage 权限](https://supabase.com/docs/guides/storage/security/access-control)。
- 注销沿用旧平台已知表和归属文件清理，service role 仅在 API 端。使用专用测试账号验证，跨存储清理失败可重试，不是单个数据库事务。
- 反馈 SMTP / 附件设置与 Supabase 认证邮件是两套配置，分别验证。文件选择成功不代表上传或邮件成功。

网页注销入口为 `https://vocespace.com/deleteAccount`，由 Web 3030 提供页面，`/api/v1/account/web-*` 由 API 3031 处理。与本批 Web / API 一起部署，保留完整 `/api` 路径。`ACCOUNT_PUBLIC_URL` 必须与浏览器访问的 origin 一致；登录使用短期 HttpOnly Cookie，最终删除还需密码与显式确认。验收使用专用可删除账号，不对真实业务账号做删除测试。

## 8. 可选主会场预览

保持既有 Egress 与 LiveKit 配对；在业务配置中设置 S3 的 `bucket/accessKey/secretKey/region`，按对象存储填写 `PREVIEW_S3_ENDPOINT`。专用预览对象不要开放匿名读。

`PREVIEW_RENDERER_BASE_URL=https://vocespace.com`，模板位于 `/api/preview/*`，由 Caddy 转发到 3031；`/twirp/*` 仍到 LiveKit 7880。确保 Egress 能访问模板、LiveKit 和 S3，再将数据目录环境文件的 `PREVIEW_ENABLED` 改为 `true`，使用 `pm2 restart vocespace-api` 加载新文件。修改 ecosystem 的值则重新读取该配置并带 `--update-env`，不要仅刷新 Web。

以真实主会场验证 HLS 首帧、音画、私密隔离、连续有效播放 10 秒自动加入和 HLS → RTC 释放，再扩量。异常时设回 `PREVIEW_ENABLED=false` 并重启 API，保留手动加入。

## 9. 后续升级、备份与回退

1. 记录当前发布目录 / commit、Node / pnpm 版本、PM2 配置、Caddy 配置和数据目录。将新版本放入另一个 release 目录，按第 4 节完成构建，复制不含密钥的 ecosystem 配置。不要在旧 `.next` 中原地 build。
2. 维护窗口内停止唯一写入者；API 停止后，备份 `/var/vocespace/api-data` 和同一时点 Redis 数据。外部 Redis 使用供应方一致性快照；本机 Redis 按现有持久化流程备份。其他写同一 Redis 的程序也需纳入备份方案。备份包含密钥，限制访问。
3. 删除这两个已停止的 PM2 登记，然后用新目录配置启动，确保 script / cwd 真正切换；不使用 cluster reload 制造两个 API worker。下面命令适用于已经按本文命名的部署，旧组合服务首次迁移按第 5 节处理。

```bash
pm2 stop vocespace-web vocespace-api
# 此处完成 API 文件、环境配置与 Redis 的一致性备份，再继续。
pm2 delete vocespace-web vocespace-api
cd /var/vocespace/releases/实际新版本目录
pm2 start ecosystem.config.cjs --only vocespace-api
curl --fail http://127.0.0.1:3031/healthz
pm2 start ecosystem.config.cjs --only vocespace-web
curl --fail http://127.0.0.1:3030/healthz
pm2 describe vocespace-api
pm2 describe vocespace-web
```

4. 检查 describe 中的 script / cwd 指向新发布目录，完成公网和业务检查后 `pm2 save`。端口和路由未变时无需重复 reload Caddy。保留上一个 release 及其 node_modules / 构建产物。
5. 回退时停止并删除这两个新进程登记，切回旧 release，按同样顺序启动旧配置并验证后 `pm2 save`。若回到拆分前的组合服务，则同时恢复对应旧 Caddy 路由，保证只有旧服务写数据。
6. 只有确认数据也需回退时，才成对恢复同一备份的 API 文件与 Redis；先保留升级期间新增数据。Supabase 是独立远程存储，回退源码不会回滚已经发生的用户修改。

## 10. 测试版验收与当前状态

- 原静态首页、脚本下载、incubator 跳转、3060 原接口仍可用；Web 两个协议页和账号重置页可达。
- 测试账号：登录、注册验证码、重置、昵称修改后重新登录仍正确、头像选择 / 上传 / 取消、记住我与退出。
- Web 与 iOS / Android 入会、邀请、音视频、共享、断网恢复、后台与退出；Socket polling 和 WebSocket 正常。
- 反馈内容与附件到达指定邮箱；预览若开启，补做真实 HLS / 自动加入检查。
- 记录发布 commit、PM2 路径、设备 / 浏览器版本及失败项。

此前隔离副本标准 Web / API 构建、190 项隔离后端检查与数据初始化检查通过。本次只调整部署文档，没有连接生产服务器或执行 PM2 / Caddy 切换；本机没有 Caddy，候选配置需在服务器按第 6 节 validate 后使用。源码检查不代表 Linux 上线已验收。

仓库的 `Dockerfile`、`docker-compose.yml` 和 `deploy/compose.env.example` 仍保留作为容器部署选项；当前服务器按本文 PM2 流程即可，不需要新增 Nginx 或 Docker。

## Umami 统计（2026-10-29）

本次 Web / API 代码包含首期埋点，默认关闭。发布前的 build shell 显式设置：

```bash
export NEXT_PUBLIC_UMAMI_ENABLED=true
export NEXT_PUBLIC_UMAMI_URL=https://rds.vocespace.com
export NEXT_PUBLIC_UMAMI_WEBSITE_ID=d2fe7209-e79d-45cc-8c0d-20b5f6035ce7
bash scripts/ubuntu/deploy.sh build /var/vocespace 20261029-umami
```

然后按上文 activate 流程发布。三个变量是公共采集配置，不是 API 密钥；不要只写进 `api-data/.env.production`，该文件不参与 Web 客户端构建。手动构建同样在 `pnpm build` 前设置，Compose 流程在其 env 文件设置对应 build args 后重新 build。**仅 PM2 restart 不会更新已编译的开关**；关闭也要设置 false 后重建发布。

不需要增加 Caddy 路由，浏览器直接访问 `rds.vocespace.com`。Web 和新 API 同批发布，以取得创建 Space 的真实 `created` 回执。上线前用独立测试站点验收；正式 Umami 的版本和 Native 会话行为尚待实际联调。事件字典、脱敏范围与验收清单见 [埋点文档](埋点文档.md)。
