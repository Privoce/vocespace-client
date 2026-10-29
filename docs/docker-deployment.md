# Docker：挂载 JSON 配置

Web 与 API 为两个镜像，单个 API 写入数据。沿用已有 LiveKit、Redis、Caddy。当前 Compose 不再使用 `--env-file`、`env_file` 或业务 environment。

1. 在仓库根准备目录：

```bash
mkdir -p deploy/api-data
cp vocespace.conf.example.json deploy/api-data/vocespace.conf.json
```

已有部署不要执行覆盖命令；迁移原 JSON/上传/sql/清理队列，并按 [配置说明](configuration.md) 合并旧环境配置。

2. 编辑 `deploy/api-data/vocespace.conf.json`：

- `deployment.dataDir` 为 `.`，`deployment.publicOrigin` 为真实 HTTPS origin。
- `deployment.web.host` 和 `deployment.api.host` 均为 `0.0.0.0`。
- 端口使用模板的 3030 / 3031，`deployment.web.apiUrl` 改为 `http://api:3031`。
- 填好 LiveKit、Redis、Supabase、管理令牌等。容器里的 `127.0.0.1` 指自身，Redis 地址必须能从容器访问。
- 修改端口时同时调整 Compose 的 ports 映射。若需要挂载到其他宿主路径，修改两个服务的 volumes 和 secrets.file。

3. 允许容器 UID 1000 读取配置并写入 API 数据；配置不公开可读：

```bash
sudo chown -R 1000:1000 deploy/api-data
sudo chmod 750 deploy/api-data
sudo chmod 600 deploy/api-data/vocespace.conf.json
docker compose config --quiet
```

4. 构建：

```bash
docker compose build
```

Web build 只通过 BuildKit secret 临时读取配置以确定 basePath，不复制密钥到层内。镜像中不包含真实 JSON。直接 `docker build --target web` 时也要传 `--secret id=vocespace_config,src=/真实配置路径`；API 构建不需要秘密。

5. 先停止旧 API/worker、备份 JSON/文件和 Redis，再启动：

```bash
docker compose up -d
docker compose ps
docker compose logs --tail=80 api web
curl --fail http://127.0.0.1:3031/healthz
curl --fail http://127.0.0.1:3030/healthz
```

API 挂载整个 `/data` 为可写，Web 只读同一目录。不要将该目录作为公开静态目录。API 管理设置仍可保存 JSON，不使用配置文件只读挂载阻断保存。

6. 沿用 Caddy 路由，执行 Linux 指南中的公网/账号/会议验收。健康检查不代表 LiveKit、Supabase 或 S3 已验收。

7. 更新配置后按需 `docker compose restart api web`。basePath 变更需要重新 build Web；镜像 tag/端口/挂载是 Compose 编排参数，直接编辑 compose，不复制到 `.env`。升级前备份并记录镜像 tag，失败时切回旧镜像；不会自动回滚业务数据或 Supabase。
