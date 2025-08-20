# Dockerfile for Vocespace - Optimized

# 使用 Node.js 20 作为基础镜像 (更稳定且更小) ------------------------------------
FROM node:20-alpine AS base
WORKDIR /app

# 安装依赖阶段 -----------------------------------------------------------------
FROM base AS deps
# 只安装必要的构建工具
RUN apk add --no-cache git

# 复制依赖文件
COPY package.json pnpm-lock.yaml* ./

# 启用 corepack 并安装依赖
RUN corepack enable pnpm
RUN pnpm install --frozen-lockfile

# 构建阶段 --------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app

# 复制源代码
COPY . .

# 设置构建环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 构建应用（不使用 standalone 模式，因为我们有自定义服务器）
RUN pnpm build && \
    pnpm prune --prod && \
    rm -rf .next/cache /root/.cache /tmp/*

# 运行阶段 ---------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 安装必要工具
RUN apk add --no-cache dumb-init bash && \
    rm -rf /var/cache/apk/*

# 添加非root用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 只复制必要的运行时文件
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# 复制配置文件
COPY --from=builder --chown=nextjs:nodejs /app/vocespace.default.conf.json ./vocespace.conf.json

# 复制入口脚本
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# 创建必要目录并设置权限
RUN mkdir -p uploads && chown -R nextjs:nodejs uploads

# 切换到非root用户
USER nextjs

# 暴露3000端口
EXPOSE 3000

# 配置卷挂载（只声明目录卷，文件挂载在 docker-compose.yml 中处理）
VOLUME ["/app/uploads"]

# 使用入口脚本启动服务
ENTRYPOINT ["dumb-init", "/app/entrypoint.sh"]