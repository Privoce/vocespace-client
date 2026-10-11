# Build from repository root. Select --target web or --target api.
FROM node:24.12.0-bookworm-slim AS dependencies
WORKDIR /workspace
ENV npm_config_store_dir=/pnpm/store
RUN npm install --global pnpm@10.27.0
COPY . .
RUN --mount=type=cache,id=vocespace-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM dependencies AS web-build
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN pnpm build:web

FROM dependencies AS api-build
RUN --mount=type=cache,id=vocespace-pnpm,target=/pnpm/store \
    pnpm build:api && pnpm package:api /runtime

FROM node:24.12.0-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=web-build --chown=node:node /workspace/apps/web/.next/standalone ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

FROM node:24.12.0-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3001 VOCESPACE_DATA_DIR=/data
COPY --from=api-build --chown=node:node /runtime ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "start.mjs"]
