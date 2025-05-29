# Dockerfile for Vocespace

# 使用 Node.js 18 作为基础镜像 --------------------------------------------------
FROM node:23-alpine AS base

# 设置工作目录 -----------------------------------------------------------------
WORKDIR /app

# 安装依赖阶段 -----------------------------------------------------------------
FROM base AS deps
# 安装构建工具 -----------------------------------------------------------------
RUN apk add --no-cache libc6-compat git
# 复制 package.json 相关文件 ---------------------------------------------------
COPY package.json ./
# COPY package-lock.json* ./
# COPY yarn.lock* ./
COPY next.config.js ./
COPY pnpm-lock.yaml* ./
COPY server.js ./
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

# 配置 next.config.js 启用 standalone 输出
RUN sed -i 's/output: undefined/output: "standalone"/g' next.config.js || echo 'output already set'

# 构建项目 ---------------------------------------------------------------------
ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV NODE_ENV production
RUN pnpm build
# 删除构建缓存
RUN rm -rf .next/cache
# 运行阶段 ---------------------------------------------------------------------
# FROM deps AS runner
FROM node:23-alpine AS runner
WORKDIR /app
# 设置为生产环境 ----------------------------------------------------------------
ENV NODE_ENV production
# 安装必要工具
RUN apk add --no-cache bash

# 复制预下载的 LiveKit 服务器二进制包
# COPY livekit_1.8.4_linux_arm64.tar.gz /tmp/
# # 解压二进制文件到 /usr/local/bin 目录
# RUN tar -xzf /tmp/livekit_1.8.4_linux_arm64.tar.gz -C /usr/local/bin --wildcards --no-anchored "livekit*" && \
#     chmod +x /usr/local/bin/livekit-server && \
#     rm /tmp/livekit_1.8.4_linux_arm64.tar.gz

# 添加非root用户 ---------------------------------------------------------------
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 创建uploads目录并设置权限, 作为文件存储目录 --------------------------------------
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# 创建并配置入口点脚本 -----------------------------------------------------------
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

RUN mkdir -p /app/.npm-cache && \
    chown -R nextjs:nodejs /app/.npm-cache
# 复制整个应用 ------------------------------------------------------------------
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.env.local ./.env.local
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js
RUN npm install -g pnpm

USER root

# 暴露3000端口 -----------------------------------------------------------------
EXPOSE 3000

VOLUME ["/app/.npm-cache"]
# 使用入口脚本启动服务 -----------------------------------------------------------
ENTRYPOINT ["/app/entrypoint.sh"]