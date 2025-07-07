#!/bin/bash
set -e

echo "=== 容器启动开始 ==="

# 设置 npm 缓存目录
export NPM_CONFIG_CACHE=/app/.npm-cache

# 检查是否需要安装 Socket.IO
echo "=== 检查 Socket.IO ==="
    
# 检查是否已安装
if [ ! -d "/app/node_modules/socket.io" ]; then
    echo "正在安装 Socket.IO（使用缓存）..."
    pnpm add socket.io
    echo "✅ Socket.IO 安装完成"
else
    echo "✅ Socket.IO 已存在，跳过安装"
fi

# 直接重写整个.env文件
cat > /app/.env.local << EOF
LIVEKIT_API_KEY=${LIVEKIT_API_KEY:-devkey}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET:-secret}
LIVEKIT_URL=${LIVEKIT_URL:-ws://localhost:7880}
NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH:-}
PORT=${PORT:-3000}
HOST=${HOST:-0.0.0.0}
TURN_CREDENTIAL=${TURN_CREDENTIAL:-}
TURN_URL=${TURN_URL:-}
TURN_USERNAME=${TURN_USERNAME:-}
WEBHOOK=${WEBHOOK:-}
NEXT_PUBLIC_RESOLUTION=${NEXT_PUBLIC_RESOLUTION:-1080p}
EOF

# 替换构建产物中的占位符
find /app/.next -type f -name "*.js" -exec sed -i "s|__LIVEKIT_API_KEY_PLACEHOLDER__|${LIVEKIT_API_KEY:-devkey}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__LIVEKIT_API_SECRET_PLACEHOLDER__|${LIVEKIT_API_SECRET:-secret}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__LIVEKIT_URL_PLACEHOLDER__|${LIVEKIT_URL:-ws://localhost:7880}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__TURN_CREDENTIAL_PLACEHOLDER__|${TURN_CREDENTIAL:-}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__TURN_URL_PLACEHOLDER__|${TURN_URL:-}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__TURN_USERNAME_PLACEHOLDER__|${TURN_USERNAME:-}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__PORT_PLACEHOLDER__|${PORT:-3000}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__NEXT_PUBLIC_BASE_PATH_PLACEHOLDER__|${NEXT_PUBLIC_BASE_PATH:-}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__WEBHOOK_PLACEHOLDER__|${WEBHOOK:-false}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__HOST_PLACEHOLDER__|${HOST:-0.0.0.0}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__NEXT_PUBLIC_RESOLUTION_PLACEHOLDER__|${NEXT_PUBLIC_RESOLUTION:-1080p}|g" {} \;

echo "环境变量配置:"
cat /app/.env.local

echo "=== 启动应用 ==="

node server.js