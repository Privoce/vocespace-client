#!/bin/bash
set -e

echo "=== 容器启动开始 ==="

# 设置 npm 缓存目录
export NPM_CONFIG_CACHE=/app/.npm-cache

# 设置环境变量并创建 .env.local 文件
echo "=== 配置环境变量 ==="
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
NEXT_PUBLIC_MAXBITRATE=${NEXT_PUBLIC_MAXBITRATE:-12000}
NEXT_PUBLIC_MAXFRAMERATE=${NEXT_PUBLIC_MAXFRAMERATE:-30}
NEXT_PUBLIC_PRIORITY=${NEXT_PUBLIC_PRIORITY:-medium}
EOF

echo "环境变量配置:"
cat /app/.env.local

# 清理之前的构建
rm -rf .next
    
pnpm install

# 执行构建
echo "正在构建..."
pnpm build
    
# 清理构建缓存
rm -rf .next/cache

echo "恢复生产依赖并清理开发依赖..."
rm -rf node_modules
pnpm store prune || true
echo "✅ 构建完成并已清理开发依赖"
# 检查是否需要安装 Socket.IO
echo "=== 检查 Socket.IO ==="
if [ ! -d "/app/node_modules/socket.io" ]; then
    echo "正在安装 Socket.IO（使用缓存）..."
    pnpm add socket.io
    echo "✅ Socket.IO 安装完成"
else
    echo "✅ Socket.IO 已存在，跳过安装"
fi

# 检查是否需安装 dotenv
echo "=== 检查 dotenv ==="
if [ ! -d "/app/node_modules/dotenv" ]; then
    echo "正在安装 dotenv（使用缓存）..."
    pnpm add dotenv
    echo "✅ dotenv 安装完成"
else
    echo "✅ dotenv 已存在，跳过安装"
fi

echo "=== 启动应用 ==="
node server.js