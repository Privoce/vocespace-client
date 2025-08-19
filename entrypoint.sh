#!/bin/bash
set -e

# 直接重写整个.env文件
cat > /app/.env.local << EOF
LIVEKIT_API_KEY=${LIVEKIT_API_KEY:-devkey}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET:-secret}
LIVEKIT_URL=${LIVEKIT_URL:-ws://127.0.1:7880}
NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH:-}
PORT=${PORT:-3000}
TURN_CREDENTIAL=${TURN_CREDENTIAL:-}
TURN_URL=${TURN_URL:-}
TURN_USERNAME=${TURN_USERNAME:-}
WEBHOOK=${WEBHOOK:-}
EOF

# 替换构建产物中的占位符
find /app/.next -type f -name "*.js" -exec sed -i "s|__LIVEKIT_API_KEY_PLACEHOLDER__|${LIVEKIT_API_KEY:-devkey}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__LIVEKIT_API_SECRET_PLACEHOLDER__|${LIVEKIT_API_SECRET:-secret}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__LIVEKIT_URL_PLACEHOLDER__|${LIVEKIT_URL:-wss://space.voce.chat}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__TURN_CREDENTIAL_PLACEHOLDER__|${TURN_CREDENTIAL:-}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__TURN_URL_PLACEHOLDER__|${TURN_URL:-}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__TURN_USERNAME_PLACEHOLDER__|${TURN_USERNAME:-}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__PORT_PLACEHOLDER__|${PORT:-3000}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__NEXT_PUBLIC_BASE_PATH_PLACEHOLDER__|${NEXT_PUBLIC_BASE_PATH:-/chat}|g" {} \;
find /app/.next -type f -name "*.js" -exec sed -i "s|__WEBHOOK_PLACEHOLDER__|${WEBHOOK:-false}|g" {} \;

echo "环境变量配置:"
cat /app/.env.local