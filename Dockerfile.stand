# Dockerfile for Vocespace

# 使用 Node.js 23 作为基础镜像 --------------------------------------------------
FROM node:23-alpine AS base
WORKDIR /app

# 安装依赖阶段 -----------------------------------------------------------------
FROM base AS deps
# 安装构建工具
RUN apk add --no-cache libc6-compat git

# 复制依赖文件
COPY package.json ./
COPY pnpm-lock.yaml* ./
COPY next.config.js ./

# 安装依赖
RUN npm install pnpm -g
RUN pnpm install --frozen-lockfile

# 构建阶段 --------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app

# 复制源代码
COPY . .

# 设置构建环境变量
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 构建应用
RUN pnpm build

# 运行阶段 ---------------------------------------------------------------------
FROM node:23-alpine AS runner
WORKDIR /app

# 设置生产环境
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 安装必要工具
RUN apk add --no-cache bash

# 添加非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物和必要文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 复制自定义服务器文件和配置
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml

# 复制默认配置文件并重命名为实际使用的配置文件
COPY --from=builder --chown=nextjs:nodejs /app/vocespace.default.conf.json ./vocespace.conf.json

# 安装运行时依赖
RUN npm install pnpm -g
RUN pnpm install --prod --frozen-lockfile

# 创建必要目录并设置权限
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads
RUN mkdir -p /app/.npm-cache && chown -R nextjs:nodejs /app/.npm-cache
RUN chown -R nextjs:nodejs /app/node_modules

# 创建并配置入口点脚本
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# 切换到非root用户
USER nextjs

# 暴露3000端口
EXPOSE 3000

# 配置卷挂载（只声明目录卷，文件挂载在 docker-compose.yml 中处理）
VOLUME ["/app/uploads"]

# 使用入口脚本启动服务
ENTRYPOINT ["/app/entrypoint.sh"]