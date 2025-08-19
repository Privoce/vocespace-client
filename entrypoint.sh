#!/bin/bash
set -e

echo "正在启动 VoceSpace..."

# 检查是否有挂载的自定义配置文件（只在有文件挂载时才会覆盖）
if [ -f "/app/vocespace.conf.json" ]; then
    # 如果配置文件存在但为空，说明可能是挂载失败，不做任何操作
    if [ -s "/app/vocespace.conf.json" ]; then
        echo "使用配置文件..."
    else
        echo "配置文件为空，可能存在挂载问题，请检查配置文件。"
    fi
else
    echo "配置文件不存在，这不应该发生。"
    exit 1
fi

# 显示当前配置
echo "当前配置:"
cat /app/vocespace.conf.json

# 确保上传目录存在并具有正确权限
mkdir -p /app/uploads
chmod 755 /app/uploads

echo "配置完成，启动应用..."

# 启动应用
exec node server.js