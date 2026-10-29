# Ubuntu 部署 Web 与 API

应用配置统一使用 `vocespace.conf.json`，结构定义在 `packages/domain/src/config.ts`，完整模板是根目录 `vocespace.conf.example.json`。Web/API 启动不再读取 `.env` 文件，也不接受旧业务环境变量覆盖 JSON。配置字段、旧变量映射与 Docker 挂载见 [配置说明](docs/configuration.md) 和 [Docker 部署](docs/docker-deployment.md)。

以下沿用源码 `/root/vocespace/vocespac-client`、部署目录 `/var/vocespace/main`、Web 3030、API 3031。可使用 root；所有步骤使用同一个用户及 PM2 环境。现有 Caddy、Redis、LiveKit 和 3060 服务继续沿用。

## 一、脚本部署

### 步骤 1：更新源码

```bash
cd /root/vocespace/vocespac-client
git status --short
# 确认没有未处理的本地修改，再更新当前分支
git pull --ff-only
```

### 步骤 2：准备 Ubuntu 依赖和 Node

```bash
bash scripts/ubuntu/setup.sh /var/vocespace/main
source /var/vocespace/main/tools/env.sh
```

如果此前 CrowdSec 的 questing 源 404 阻断安装，确认 Ubuntu 源文件存在后改用：

```bash
VOCESPACE_APT_SOURCES=/etc/apt/sources.list.d/ubuntu.sources \
  bash scripts/ubuntu/setup.sh /var/vocespace/main
source /var/vocespace/main/tools/env.sh
```

两种 setup 命令选一种。指定源只作用于本次 apt update/install，不改系统源，不关闭签名校验。`tools/env.sh` 仅设置 Node 的 PATH，不是应用环境配置。setup 不安装 Redis 服务端，不重启现有业务。

### 步骤 3：准备唯一的 JSON 配置

```bash
cd /root/vocespace/vocespac-client
bash scripts/ubuntu/deploy.sh init /var/vocespace/main
pnpm install --frozen-lockfile
```

init 只在缺失时复制模板，绝不覆盖既有 JSON。你已有旧部署，先用旧应用实际读取的 JSON 作为迁移输入。下面路径必须换成实际路径；不存在的 `--env` 参数应删去，多个环境文件按旧优先级排列（前面的优先）。

```bash
node scripts/config.mjs migrate \
  --config /var/vocespace/main/api-data/vocespace.conf.json \
  --from /旧应用实际目录/vocespace.conf.json \
  --env /var/vocespace/main/api-data/.env.production \
  --env /旧应用实际目录/services/api/.env.local \
  --env /旧应用实际目录/.env.local
nano /var/vocespace/main/api-data/vocespace.conf.json
chmod 600 /var/vocespace/main/api-data/vocespace.conf.json
node scripts/config.mjs check --config /var/vocespace/main/api-data/vocespace.conf.json
```

如果你已经填写过本轮部署的 `api-data/.env.production`，请将它像上面一样作为迁移输入，保留其中的 Supabase 等配置；文件不存在则去掉该参数。这是唯一一次显式读取旧 `.env` 的迁移工具，后续运行不再加载它们。工具保留已有 JSON 字段，补入环境变量中缺失的字段，写入前备份目标 JSON；不打印密钥。已有字段即使为空，也不会被环境变量覆盖，需手动补齐。

全新安装跳过 migrate，直接编辑模板。至少核对：

- `livekit`、`redis`、`hostToken`：保留真实实例和管理令牌。
- `deployment.publicOrigin`：`https://vocespace.com`；`basePath` 通常为空；`dataDir` 保持 `.`。
- `deployment.web`：`host: "127.0.0.1"`、`port: 3030`、`apiUrl: "http://127.0.0.1:3031"`。
- `deployment.api`：`host: "127.0.0.1"`、`port: 3031`；`workerEnabled: true`。
- `account.supabase`：填写 `url`、`publishableKey`、`serviceRoleKey`。旧本机配置在 `services/api/.env.local`，不能遗漏。
- `account.publicUrl`：可留空，默认使用 publicOrigin + basePath；显式填写时必须是本应用账号回调地址。
- `account.platformJwtSecret`、`billing.licenseSecret`：使用对应功能时沿用原密钥，不重新生成导致旧令牌失效。
- `smtp`、`s3`、`ai`、`hyperbeam`：沿用原会议配置；预览初始保持 `preview.enabled: false`。
- `analytics`：默认关闭，启用时填写 URL / Website ID；不再设置 NEXT_PUBLIC 或 EXPO_PUBLIC 变量。

`check` 检查 JSON 结构，不验证外部服务连接。init 不是迁移完成；不要用空模板覆盖旧配置或重置 Redis。

### 步骤 4：构建独立版本

```bash
cd /root/vocespace/vocespac-client
source /var/vocespace/main/tools/env.sh
bash scripts/ubuntu/deploy.sh build /var/vocespace/main release-001
```

脚本复制源码到独立目录并安装依赖、构建 API/Web、执行检查。只将 `deployment.basePath` 投影到 Web 构建文件，不把业务 JSON 或密钥复制进 release。此时旧服务可继续运行。已有 release 名称不能复用。

### 步骤 5：首次迁移旧业务数据

已经使用固定 `api-data` 的后续升级跳过此步骤。首次迁移先确认旧 PM2 名称及数据目录，记录恢复方式后停止旧 VoceSpace 写入者：

```bash
pm2 list
pm2 describe '旧VoceSpace应用名'
pm2 stop '旧VoceSpace应用名'
```

只操作已确认的 VoceSpace Web/API/worker，不执行 `pm2 stop all`。在旧进程停止后，备份并迁移数据；上一步已经迁好的新 JSON 不要被旧 JSON 覆盖：

```bash
(
  set -e
  umask 077
  OLD_DATA='/替换为旧应用实际数据目录'
  test -f "$OLD_DATA/vocespace.conf.json"
  BACKUP=$(mktemp -d /var/vocespace/main/backups/migration.XXXXXX)
  ITEMS=(vocespace.conf.json)
  for item in uploads sql lib/uploads; do
    if [[ -e "$OLD_DATA/$item" ]]; then ITEMS+=("$item"); fi
  done
  tar -czf "$BACKUP/old-data.tar.gz" -C "$OLD_DATA" "${ITEMS[@]}"
  for item in uploads sql lib/uploads; do
    if [[ -e "$OLD_DATA/$item" ]]; then
      mkdir -p "/var/vocespace/main/api-data/$(dirname "$item")"
      rsync -a "$OLD_DATA/$item" "/var/vocespace/main/api-data/$(dirname "$item")/"
    fi
  done
)
```

如果停机前旧控制台修改过配置，应在停机后重新迁移最新旧 JSON、复查部署地址，再继续。其他业务文件按实际路径一并备份迁移。已有同名 `vocespace-api` / `vocespace-web` 旧登记时，备份恢复方式后仅删除对应已停止登记，脚本不会接管外部进程。

### 步骤 6：激活并检查

```bash
cd /root/vocespace/vocespac-client
bash scripts/ubuntu/deploy.sh activate /var/vocespace/main release-001
bash scripts/ubuntu/deploy.sh status /var/vocespace/main
curl --fail http://127.0.0.1:3031/healthz
curl --fail http://127.0.0.1:3030/healthz
```

激活前校验 JSON、进程归属、端口和构建子路径；随后备份 api-data / Redis、启动单实例 API，再启动 Web。失败时尝试恢复原已管理版本，不恢复数据库。Redis 备份读取 JSON；托管 Redis 不允许复制快照时，可提供 `REDIS_BACKUP_HOOK=/绝对路径/backup.sh`，脚本接收备份目录和数据目录两个参数，失败必须非零退出。

### 步骤 7：检查现有公网路由和业务

本流程不改 Caddy。确认当前规则仍满足：

| 路径 | 目标 |
| --- | --- |
| `/api/s3/*`、旧 `/api/rooms/*`、`/api/license/*` | 原 3060 服务 |
| `/rtc*`、`/twirp/*` | 原 LiveKit 7880 |
| `/socket.io/*`、其他 Web/API 路径 | Web 3030，再由 Web 转发 API 3031 |
| `/` 静态官网 | 原静态目录 |

单独的 Native `/api/native/rooms`、`/api/v1/native/rooms` 应到当前 API。健康检查只代表进程存活，继续验证账号登录/验证码/资料/头像、会议加入和音视频、反馈、注销入口 `/deleteAccount`。注销验收使用独立测试账号。

只有完成 Egress、S3 和真实播放验证后才打开 `preview.enabled`；媒体 TCP/UDP/TURN 配置仍由现有 LiveKit 部署负责。

### 步骤 8：开机启动

```bash
pm2 startup
# 执行上一条命令针对当前用户给出的命令
pm2 save
```

### 步骤 9：后续升级或修改配置

```bash
cd /root/vocespace/vocespac-client
git pull --ff-only
source /var/vocespace/main/tools/env.sh
bash scripts/ubuntu/deploy.sh build /var/vocespace/main release-002
bash scripts/ubuntu/deploy.sh activate /var/vocespace/main release-002
```

数据和唯一 JSON 留在 api-data，不在 release 中。普通配置修改后重启相应进程；Redis/监听地址/worker 等连接级参数需要重启。Web 的 Umami 配置读取运行时 JSON，新页面加载即可使用；现有页面需刷新。修改 `deployment.basePath` 必须重建 Web；脚本端口变更也需生成新 release 元数据，必要时由你调整现有代理。

### 步骤 10：回退

```bash
cd /root/vocespace/vocespac-client
bash scripts/ubuntu/deploy.sh rollback /var/vocespace/main
bash scripts/ubuntu/deploy.sh status /var/vocespace/main
```

回退代码，不覆盖配置、Redis 或新增数据。恢复数据需保留当前数据后成对恢复同一时点的文件和 Redis。首次迁移失败尚无 previous，按已记录的旧 PM2 启动方式恢复；不能同时运行新旧写入者。回到本次迁移前的版本时，还需恢复该版本所需的旧环境文件及启动参数。

## 二、源码部署

### 步骤 1：准备工具和源码

沿用第一部分步骤 1–2。也可以使用已有 Node 24.12.0、pnpm 10.27.0、PM2、rsync、redis-cli，不必重复安装。固定同一个部署用户。

### 步骤 2：准备 JSON 和数据目录

```bash
mkdir -p /var/vocespace/main/api-data /var/vocespace/main/releases /var/vocespace/main/backups
cd /root/vocespace/vocespac-client
pnpm install --frozen-lockfile
# 仅缺少配置的全新安装执行；已存在时 init 拒绝覆盖
node scripts/config.mjs init --config /var/vocespace/main/api-data/vocespace.conf.json
```

已有部署按第一部分步骤 3 运行 migrate，核对全部地址和密钥。没有运行时 `.env.production`。

### 步骤 3：复制独立源码

```bash
(
  set -e
  SOURCE_DIR=/root/vocespace/vocespac-client
  RELEASE_DIR=/var/vocespace/main/releases/manual-001
  test ! -e "$RELEASE_DIR"
  mkdir -p "$RELEASE_DIR"
  for item in apps packages services scripts patches package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json .nvmrc .eslintrc.json .prettierrc .prettierignore LICENSE vocespace.conf.example.json; do
    rsync -a --safe-links --exclude-from="$SOURCE_DIR/scripts/ubuntu/source.exclude" "$SOURCE_DIR/$item" "$RELEASE_DIR/"
  done
)
```

不能在运行中的 `.next` 目录 build，也不能复用旧 node_modules 软链接。

### 步骤 4：安装并构建

```bash
(
  set -e
  cd /var/vocespace/main/releases/manual-001
  unset NODE_ENV
  pnpm install --frozen-lockfile
  node scripts/config.mjs web-build --config /var/vocespace/main/api-data/vocespace.conf.json
  pnpm check:boundaries
  pnpm build
  pnpm check:deployment
)
```

生成的 `apps/web/vocespace.build.json` 仅包含构建子路径；完整业务 JSON 始终在 api-data。构建失败时停止，不启动不完整版本。

### 步骤 5：创建 PM2 配置

在 `/var/vocespace/main/releases/manual-001/ecosystem.config.cjs` 写入：

```javascript
const root = '/var/vocespace/main/releases/manual-001';
const common = {
  interpreter: process.execPath,
  exec_mode: 'fork', instances: 1, watch: false,
  autorestart: true, restart_delay: 3000, kill_timeout: 30000,
  args: ['--config', '/var/vocespace/main/api-data/vocespace.conf.json'],
  env: { NODE_ENV: 'production' },
};
module.exports = { apps: [
  { ...common, name: 'vocespace-api', cwd: root, script: `${root}/services/api/start.mjs` },
  { ...common, name: 'vocespace-web', cwd: `${root}/apps/web`, script: `${root}/apps/web/server.js` },
] };
```

`NODE_ENV` 是框架模式，业务地址、端口及密钥都在 JSON，不在 PM2 env 中。不要直接运行 API dist，不使用 cluster 或多 API 实例。

### 步骤 6：停止旧写入者，迁移并备份

首次迁移按第一部分步骤 5 处理。已有固定数据目录时只备份，不复制旧数据覆盖当前数据。停止旧写入者后：

```bash
(
  set -e
  umask 077
  cd /var/vocespace/main/releases/manual-001
  test -f /var/vocespace/main/api-data/vocespace.conf.json
  BACKUP=$(mktemp -d /var/vocespace/main/backups/manual.XXXXXX)
  tar -czf "$BACKUP/api-data.tar.gz" -C /var/vocespace/main/api-data .
  node scripts/ubuntu/deploy-tools.mjs backup-redis /var/vocespace/main/releases/manual-001 /var/vocespace/main "$BACKUP"
)
```

备份成功后，按需删除已停止且同名的旧 PM2 登记。保留旧版本和恢复方式。

### 步骤 7：先 API 后 Web 启动

```bash
cd /var/vocespace/main/releases/manual-001
pm2 start ecosystem.config.cjs --only vocespace-api
curl --fail --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:3031/healthz
pm2 start ecosystem.config.cjs --only vocespace-web
curl --fail --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:3030/healthz
pm2 describe vocespace-api
pm2 describe vocespace-web
```

每条命令成功再继续，错误查看 `pm2 logs vocespace-api --lines 60 --nostream`。确认 script 指向 manual-001，args 指向固定 JSON，API 仅一个实例。

### 步骤 8：公网验收和开机启动

按第一部分步骤 7 检查公网和业务，再执行 `pm2 startup` 输出的当前用户命令及 `pm2 save`。

### 步骤 9：手动升级

将步骤 3–5 中的版本改成 manual-002，完成独立构建。按步骤 6 停止旧写入者并备份，随后删除已停止的 `vocespace-api` / `vocespace-web` 登记，从新版本按步骤 7–8 启动和验收。保留 manual-001；不使用脚本的 build/activate/rollback 混管手动版本。

### 步骤 10：手动回退

先按步骤 6 备份当前数据，停止并删除新版本对应的两个进程，进入旧版本：

```bash
cd /var/vocespace/main/releases/manual-001
pm2 start ecosystem.config.cjs --only vocespace-api
curl --fail http://127.0.0.1:3031/healthz
pm2 start ecosystem.config.cjs --only vocespace-web
curl --fail http://127.0.0.1:3030/healthz
pm2 save
```

只回退代码，不回滚 Supabase / Redis / 配置。完成公网回归后再结束维护窗口。
