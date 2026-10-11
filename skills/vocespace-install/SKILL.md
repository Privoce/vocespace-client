---
name: vocespace-install
description: Install, upgrade, or troubleshoot this VoceSpace monorepo's independent Web and API services using its Docker targets or packaged Node artifacts, while preserving existing data and external LiveKit services.
---

Read [the deployment guide](../../docs/independent-deployment.md) and the current Dockerfile, docker-compose.yml, and deploy/compose.env.example before preparing an installation. Use the user's chosen target hosts and existing LiveKit/Egress/Redis services; ask only for missing deployment inputs that affect the next action.

- Build from the repository root with the web/api target. Old combined Next/LiveKit entrypoints are retired. pnpm manages the workspace; Lerna is not required.
- Web receives only the API upstream and public settings. API owns secrets, `/data`, Socket and worker; run one API writer. Native connects to the publicly reachable API endpoint.
- First installation is opt-in and must not replace an existing vocespace.conf.json. Preserve config, uploads, sql, lib/uploads/S3_clean.json and matching Redis data when migrating. Check container ownership for bind mounts.
- For independent hosts, use `up --no-deps web` for Web and an external API URL. Keep PUBLIC_ORIGIN tied to the browser's Web origin. NEXT_PUBLIC_BASE_PATH requires a matching Web build.
- Prepare configuration with placeholders or locally provided secrets; do not print secrets or copy local data into build contexts. Follow the user's existing authorization for actual deployment or publishing.
- Validate Compose without starting services first; then validate artifacts/containers in the authorized target. Health endpoints prove process liveness only. Report actual build/start/HTTP/Socket results separately from real LiveKit, HLS and phone media checks.
- Before upgrading, record image tags and obtain a consistent API-files/Redis backup. Do not delete volumes or run an old and new worker against the same data. Stop on failed initialization, unreadable existing config or ambiguous data ownership; preserve the files for diagnosis.
