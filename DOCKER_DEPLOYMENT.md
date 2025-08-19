# VoceSpace Docker 部署说明

## 部署方式选择

### 方式一：仅 Docker 化 VoceSpace（推荐）

适用于已在宿主机运行 LiveKit Server 和 Redis 的情况。

**前提条件：**
- 宿主机运行 LiveKit Server (端口 7880)
- 宿主机运行 Redis (端口 6379，可选)

**启动命令：**
```bash
# 方式1: 使用独立配置文件
docker-compose -f docker-compose.standalone.yml up --build -d

# 方式2: 仅启动 VoceSpace 服务
docker-compose up vocespace

# 方式3: 使用预构建镜像直接运行
docker run -p 3000:3000 \
  --add-host host.docker.internal:host-gateway \
  -v vocespace_uploads:/app/uploads \
  privoce/vocespace:latest
```

### 方式二：完整 Docker 部署

包含 VoceSpace、LiveKit Server 和 Redis 的完整容器化部署。

**启动命令：**
```bash
docker-compose up --build -d
```

## 构建多架构镜像

```bash
# 构建 ARM64 镜像
docker buildx build --platform linux/arm64 --load -t privoce/vocespace:preview .

# 构建多架构镜像
docker buildx build --platform linux/arm64,linux/amd64 -t privoce/vocespace:latest .
```

### 2. 使用自定义配置

1. 复制默认配置文件：
```bash
cp vocespace.conf.json.example vocespace.conf.json
```

2. 编辑配置文件 `vocespace.conf.json`：
```json
{
  "livekit": {
    "key": "your-livekit-key",
    "secret": "your-livekit-secret", 
    "url": "ws://your-livekit-server:7880"
  },
  "codec": "vp9",
  "resolution": "1080p",
  "maxBitrate": 3000000,
  "maxFramerate": 30,
  "priority": "medium",
  "redis": { 
    "enabled": false, 
    "host": "localhost", 
    "port": 6379, 
    "password": "", 
    "db": 0 
  },
  "server_url": "your-domain.com"
}
```

3. 修改 docker-compose.yml，取消注释配置文件挂载：
```yaml
volumes:
  - uploads:/app/uploads
  - ./vocespace.conf.json:/app/vocespace.conf.json:ro  # 取消注释这行
```

4. 启动服务：
```bash
docker-compose up --build -d
```

### 重要提示

- 默认情况下，容器会使用内置的默认配置启动
- 如果要使用自定义配置，必须确保 `vocespace.conf.json` 文件存在于项目根目录
- 配置文件挂载是只读的 (`:ro`)，容器内无法修改
- 如果配置文件格式错误或为空，请检查配置文件内容和挂载路径
- 容器构建时会自动安装运行时依赖，确保所有必要的包都能正常工作

## 配置说明

### 宿主机服务配置（推荐方式）

当使用方式一时，VoceSpace 容器会通过 `host.docker.internal` 访问宿主机服务：

| 服务 | 宿主机地址 | 容器访问地址 | 说明 |
|------|------------|--------------|------|
| LiveKit Server | localhost:7880 | host.docker.internal:7880 | 必需 |
| Redis | localhost:6379 | host.docker.internal:6379 | 可选 |

### VoceSpace 配置 (vocespace.conf.json)

| 参数 | 说明 | 默认值 (宿主机模式) | 默认值 (容器模式) |
|------|------|---------------------|-------------------|
| `livekit.url` | LiveKit 服务器地址 | ws://host.docker.internal:7880 | ws://livekit:7880 |
| `redis.host` | Redis 主机地址 | host.docker.internal | redis |
| `redis.enabled` | 是否启用 Redis | true | false |

### 自定义配置示例

**宿主机服务模式：**
```json
{
  "livekit": {
    "key": "your-key",
    "secret": "your-secret",
    "url": "ws://host.docker.internal:7880"
  },
  "redis": {
    "enabled": true,
    "host": "host.docker.internal",
    "port": 6379
  }
}
```

**容器服务模式：**
```json
{
  "livekit": {
    "key": "your-key", 
    "secret": "your-secret",
    "url": "ws://livekit:7880"
  },
  "redis": {
    "enabled": true,
    "host": "redis",
    "port": 6379
  }
}
```

### Redis 配置（可选）

Redis 用于存储聊天消息。默认情况下 Redis 是禁用的。

**启用 Redis：**

1. 修改 `docker-compose.yml`，取消注释 Redis 服务：
```yaml
redis:
  image: redis:7-alpine
  container_name: vocespace-redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
  networks:
    - vocespace-network
  command: redis-server --requirepass vocespace
```

2. 在配置文件中启用 Redis：
```json
{
  "redis": { 
    "enabled": true, 
    "host": "redis", 
    "port": 6379, 
    "password": "vocespace", 
    "db": 0 
  }
}
```

3. 取消注释 volumes 中的 redis-data：
```yaml
volumes:
  uploads:
  redis-data:
```

### LiveKit 配置 (livekit.yaml)

如果您使用内置的 LiveKit 服务器，可以修改 `livekit.yaml` 文件来配置 LiveKit 服务器。

## 文件挂载说明

### 必要挂载
- `uploads:/app/uploads` - 文件上传目录

### 可选挂载
- `./vocespace.conf.json:/app/vocespace.conf.json:ro` - 自定义配置文件
- `./livekit.yaml:/etc/livekit.yaml` - LiveKit 服务器配置

## 端口说明

- **3000** - VoceSpace Web 服务
- **7880** - LiveKit WebSocket 端口
- **7881** - LiveKit TCP 端口
- **50000-60000** - LiveKit WebRTC 端口范围

## 生产环境建议

1. **修改默认密钥**：
   - 更改 LiveKit 的 key 和 secret
   - 使用强密码

2. **配置域名和 HTTPS**：
   - 设置正确的 `server_url`
   - 配置反向代理（Nginx/Caddy）
   - 启用 SSL 证书

3. **网络配置**：
   - 确保 WebRTC 端口范围可访问
   - 配置防火墙规则

4. **监控和日志**：
   - 配置日志收集
   - 设置监控告警

## 故障排除

### 检查容器状态
```bash
docker-compose ps
docker-compose logs vocespace
docker-compose logs livekit
```

### 检查配置
```bash
docker exec vocespace cat /app/vocespace.conf.json
```

### 重启服务
```bash
docker-compose restart
```

## 更新升级

```bash
# 拉取最新镜像
docker-compose pull

# 重启服务
docker-compose up -d
```

```
docker run -d \
-p 3000:3000 \
-v ./vocespace.json:/app/vocespace.conf.json \
--name vocespace \
privoce/vocespace:preview
```