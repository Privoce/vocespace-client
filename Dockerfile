# Dockerfile for Vocespace

# 使用 Node.js 18 作为基础镜像 --------------------------------------------------
FROM node:23-alpine AS base

# 设置工作目录 -----------------------------------------------------------------
WORKDIR /app

# 安装依赖阶段 -----------------------------------------------------------------
FROM base AS deps
# 安装构建工具 -----------------------------------------------------------------
RUN apk add --no-cache libc6-compat git curl
# 复制 package.json 相关文件 ---------------------------------------------------
COPY package.json ./
# COPY package-lock.json* ./
# COPY yarn.lock* ./
COPY next.config.cjs ./
COPY pnpm-lock.yaml* ./
COPY entrypoint.sh ./entrypoint.sh

# 安装依赖 --------------------------------------------------------------------
RUN npm install pnpm -g
RUN pnpm install

# 构建阶段 --------------------------------------------------------------------
FROM deps AS builder
# 不需要再复制node_modules，因为deps阶段已经有了 ----------------------------------
# 复制所有源代码
COPY . .

# 设置环境变量 -----------------------------------------------------------------
# 设置最基础的环境变量配置
ARG LIVEKIT_API_KEY="devkey"
ARG LIVEKIT_API_SECRET="secret"
ARG LIVEKIT_URL="ws://localhost:7880"

# 将构建参数写入.env.local ------------------------------------------------------
RUN echo "LIVEKIT_API_KEY=${LIVEKIT_API_KEY}" > .env.local \
    && echo "LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}" >> .env.local \
    && echo "LIVEKIT_URL=${LIVEKIT_URL}" >> .env.local 

# 配置 next.config.cjs 启用 standalone 输出
RUN grep -q 'output: "standalone"' next.config.cjs && echo "standalone already configured" || sed -i 's/output: undefined/output: "standalone"/g' next.config.cjs

# 构建项目 ---------------------------------------------------------------------
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV NODE_ENV=production
RUN pnpm build
# 删除构建缓存
RUN rm -rf .next/cache
# 运行阶段 ---------------------------------------------------------------------
# FROM deps AS runner
FROM node:23-alpine AS runner
WORKDIR /app
# 设置为生产环境 ----------------------------------------------------------------
ENV NODE_ENV=production
# 安装必要工具
RUN apk add --no-cache bash tar supervisor 

# 动态下载并安装 LiveKit 服务器（支持多架构）
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then \
        LIVEKIT_ARCH="amd64"; \
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then \
        LIVEKIT_ARCH="arm64"; \
    else \
        echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    curl -L -o /tmp/livekit.tar.gz "https://github.com/livekit/livekit/releases/download/v1.8.4/livekit-server-linux-${LIVEKIT_ARCH}.tar.gz" && \
    tar -xzf /tmp/livekit.tar.gz -C /usr/local/bin --wildcards --no-anchored "livekit*" && \
    chmod +x /usr/local/bin/livekit-server && \
    rm /tmp/livekit.tar.gz

# 添加非root用户 ---------------------------------------------------------------
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 创建uploads目录并设置权限, 作为文件存储目录 --------------------------------------
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# 创建并配置入口点脚本 -----------------------------------------------------------
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
# RUN ln -sf /app/entrypoint.sh /entrypoint.sh
# RUN chmod +x /entrypoint.sh

# 复制整个应用 ------------------------------------------------------------------
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.env.local ./.env.local
RUN npm install -g pnpm 

USER root
# RUN chmod +x ./entrypoint.sh
# USER nextjs

# 暴露3000端口 -----------------------------------------------------------------
EXPOSE 3000 7880

# 使用入口脚本启动服务 -----------------------------------------------------------
ENTRYPOINT ["/app/entrypoint.sh"]
