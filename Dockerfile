# Dockerfile for Vocespace

# 使用 Node.js 18 作为基础镜像 --------------------------------------------------
# FROM node:23-alpine AS base

# # 设置工作目录 -----------------------------------------------------------------
# WORKDIR /app

# # 安装依赖阶段 -----------------------------------------------------------------
# FROM base AS deps
# # 安装构建工具 -----------------------------------------------------------------
# RUN apk add --no-cache libc6-compat git
# # 复制 package.json 相关文件 ---------------------------------------------------
# COPY package.json ./
# # COPY package-lock.json* ./
# # COPY yarn.lock* ./
# COPY next.config.js ./
# COPY pnpm-lock.yaml* ./
# COPY server.js ./
# COPY entrypoint.sh ./entrypoint.sh

# # 安装依赖 --------------------------------------------------------------------
# RUN npm install pnpm -g
# RUN pnpm install

# # 构建阶段 --------------------------------------------------------------------
# FROM deps AS builder
# # 配置 next.config.js 启用 standalone 输出
# RUN sed -i 's/output: undefined/output: "standalone"/g' next.config.js || echo 'output already set'

# # 删除构建缓存
# RUN rm -rf .next/cache
# 运行阶段 ---------------------------------------------------------------------
# FROM deps AS runner
FROM node:23-alpine AS runner
WORKDIR /app
# 设置为生产环境 ----------------------------------------------------------------
ENV NODE_ENV production
# 安装必要工具
RUN apk add --no-cache bash
# 复制整个应用 ------------------------------------------------------------------
COPY . .

# 添加非root用户 ---------------------------------------------------------------
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 创建uploads目录并设置权限, 作为文件存储目录 --------------------------------------
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# 创建并配置入口点脚本 -----------------------------------------------------------
# COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh /app/entrypoint.sh
COPY --chown=nextjs:nodejs /entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

RUN mkdir -p /app/.npm-cache && \
    chown -R nextjs:nodejs /app/.npm-cache

# COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
# COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js
# COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js
# COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml* ./pnpm-lock.yaml

RUN npm install -g pnpm

USER root

# 暴露3000端口 -----------------------------------------------------------------
EXPOSE 3000

VOLUME ["/app/.npm-cache"]
# 使用入口脚本启动服务 -----------------------------------------------------------
ENTRYPOINT ["/app/entrypoint.sh"]