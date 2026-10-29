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
# Mount configuration only for the basePath build constant; never COPY secrets into an image.
RUN --mount=type=secret,id=vocespace_config,target=/workspace/vocespace.conf.json,required=true pnpm build:web

FROM dependencies AS api-build
RUN --mount=type=cache,id=vocespace-pnpm,target=/pnpm/store \
    pnpm build:api && pnpm package:api /runtime

FROM node:24.12.0-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=web-build --chown=node:node /workspace/apps/web/.next/standalone ./
USER node
EXPOSE 3030
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+JSON.parse(require('node:fs').readFileSync('/data/vocespace.conf.json','utf8')).deployment.web.port+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js", "--config", "/data/vocespace.conf.json"]

FROM node:24.12.0-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=api-build --chown=node:node /runtime ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3031
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+JSON.parse(require('node:fs').readFileSync('/data/vocespace.conf.json','utf8')).deployment.api.port+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "start.mjs", "--config", "/data/vocespace.conf.json"]
