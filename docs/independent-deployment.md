# Web / API 独立部署

2026-10-11：使用根 Dockerfile 的 `web`、`api` 目标。Web 只运行 Next 和同站代理；API 运行 HTTP、Socket、worker 和预览出口控制。Mobile 单独构建并配置 API HTTPS 地址。LiveKit/Egress/TURN 沿用已有独立部署。

## 配置与首次启动

```sh
cp deploy/compose.env.example deploy/compose.env
```

填写 PUBLIC_ORIGIN（浏览器访问 Web 的完整 HTTPS origin）、LIVEKIT_URL/KEY/SECRET、HOST_TOKEN、Redis 地址/口令。HOST_TOKEN 和实际使用的平台/证书签名密钥使用独立长随机值；不要把真实值提交仓库。LiveKit URL 必须同时能被手机和 API 访问。

使用已有 Redis：

```sh
docker compose --env-file deploy/compose.env config --quiet
docker compose --env-file deploy/compose.env up -d --build
```

需要此 Compose 启动 Redis 时，保留 REDIS_HOST=redis 并启用 profile：

```sh
docker compose --env-file deploy/compose.env --profile local-redis up -d --build
docker compose --env-file deploy/compose.env --profile local-redis ps
```

API 在 `/data/vocespace.conf.json` 不存在且 `VOCESPACE_INIT_CONFIG=true` 时初始化；缺少必需字段会停止启动。配置文件存在时永不覆盖，更新环境中的初始化字段不会修改既有配置，请通过管理功能或停服务后编辑配置。初始化保留原业务默认值，S3/SMTP/AI 后续配置。

`api-data` 保存配置、uploads、sql、`lib/uploads/S3_clean.json` 等全部业务文件；`redis-data` 保存 Redis 数据。生产 API 限单实例。可将 api 的 volume 替换成 `/srv/vocespace-data:/data`，目录须允许容器 node 用户（UID 1000）写入。

Web 没有 LiveKit 密钥或业务数据卷。两种镜像不复制本地 env、配置、上传或签名数据，服务端密钥只在运行时提供。

## 不同机器运行

同机 Compose 是方便安装的组合，不要求两者同时发布。

Web 机器配置 `VOCESPACE_API_URL=https://api.example.com`，单独构建/启动 Web：

```sh
docker compose --env-file deploy/compose.env build web
docker compose --env-file deploy/compose.env up -d --no-deps web
```

API 机器配置其 Redis / LiveKit 地址并启动 API：

```sh
docker compose --env-file deploy/compose.env build api
docker compose --env-file deploy/compose.env up -d api
```

外部 API 的 PUBLIC_ORIGIN 仍填写 Web 的公网 origin，用于浏览器会话；反向代理保留 Host 和 Origin，支持 WebSocket Upgrade。Web 服务的 `/api/*`、`/socket.io`、`/uploads/*` 同站转发到 API。Mobile 的 EXPO_PUBLIC_API_URL 指向公开 API HTTPS origin，访客使用独立 Bearer 会话。

端口默认只绑定宿主机 127.0.0.1，适合宿主机 HTTPS 网关。网关也在容器内时加入相同网络；其他机器直接访问宿主机端口时显式设置 API_BIND/WEB_BIND 和访问规则。LiveKit 媒体端口与 TLS/TURN 仍由它自己的部署负责。

Web `/healthz`、API `/healthz` 是进程存活检查，不证明 Redis/LiveKit/S3 可用。Compose 等 API healthcheck 成功后启动 Web；业务链路仍须执行加入、聊天和退出验证。预览的 PREVIEW_RENDERER_BASE_URL 必须从 Egress 容器可达，且对应更新后的 API 路径，参见 [预览部署](native-space-preview.md)。

NEXT_PUBLIC_BASE_PATH 如需设置，在 Web 构建、Web 运行和 API 运行时保持一致。它是构建参数，不能只改运行环境后复用旧 Web 镜像。独立镜像工作流默认构建根路径；子路径部署使用本地 build args 构建。

## 独立制品与发布

不使用 Docker 也可以部署，运行环境为 Node 24.12.x：

```sh
pnpm build:web
# 将 apps/web/.next/standalone 整个目录传到 Web 机器，设置 HOST/PORT/VOCESPACE_API_URL 后 node server.js。
pnpm build:api
pnpm package:api /tmp/vocespace-api-runtime
# 将该目录传到相同操作系统/架构的 API 机器，设置 VOCESPACE_DATA_DIR 后 node start.mjs。
```

sharp 等原生依赖按目标平台安装。不要把 Mac node_modules 复制到 Linux；Docker 构建或目标平台 CI 负责安装。

`.github/workflows/container-images.yml` 在 PR 构建 linux/amd64 和 linux/arm64 两个镜像目标；手动 workflow_dispatch 选择 web/api，默认只构建，显式 publish 才推送 GHCR，标签为 commit SHA。本批没有执行远程工作流或发布镜像。选择不可变标签分别升级 Web/API，发布共享协议改动前检查旧 App 兼容性。

## 旧部署迁移、备份和回退

1. 先备份旧配置、uploads、sql、lib/uploads/S3_clean.json，以及原 Redis 持久化数据；停止旧后端及其定时任务。
2. 将业务文件按原相对路径放入新 API 数据卷/绑定目录。调整副本中的 Redis/LiveKit 地址，使其从 API 容器可达；保留密钥、Redis db、业务 key 和文件内容；原部署的签名环境变量需以相同值注入新 API，不能因更换容器重新生成。
3. 新 API 挂载旧数据后启动，初始化器不会覆盖已有配置。先检查 `/healthz` 与日志，再运行业务验证，最后切换 Web 的 API 地址。
4. 日常一致性备份：停止 API 写入；本地 Redis 完成持久化并停止后，备份 api-data、redis-data；外部 Redis 使用相应快照流程。恢复时使用匹配的配置/文件/Redis 备份。
5. 记录升级前的两个镜像标签与备份。需要回退时停 API，按是否发生数据变更选择恢复一致快照，再启动旧 API/Web 标签。本批不改变数据格式。Mobile 旧安装包仍需 API 兼容，不能依靠服务器回退更新手机。

不要用 `docker compose down -v` 做普通升级，它会删除持久卷。旧 entrypoint.sh 已停用，新镜像使用独立 Node 入口。

## 验收范围

本地检查包含独立制品、安装幂等、HTTP/Socket 回归和 Compose 解析。本机 Docker Desktop 已启动；镜像构建停在 Docker Hub 的 Node 24.12.0 基础镜像元数据下载，限时重试 90 秒超时，尚未进入项目 Docker 编译步骤。容器启动、双架构镜像、真实备份恢复和生产媒体网络仍待可拉取基础镜像的环境验证；没有宣称已上线。
