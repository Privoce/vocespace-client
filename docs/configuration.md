# JSON 配置（2026-10-29）

`packages/domain/src/config.ts` 定义 `VocespaceConfig`、新增的 `RuntimeConf` 和客户端公开类型。`runtime-defaults.json` 只保存无秘密的默认值；实际配置始终来自 `vocespace.conf.json`。`@vocespace/config-node` 是 Web/API/构建工具共用的 Node 文件读取和校验器，不能导入浏览器或 Native 运行代码。

## 配置位置和优先级

- 默认从当前目录向上查找 `vocespace.conf.json`，到 monorepo 根目录为止。
- Web/API 可用 `node ... --config /绝对路径/vocespace.conf.json` 指定文件；没有环境变量覆盖，也不自动加载 `.env`。
- `deployment.dataDir` 相对配置文件解析。Ubuntu 生产 JSON 在 `/var/vocespace/main/api-data`，值为 `.`。启动 API 后固定 cwd 到该目录，上传、sql、清理队列继续使用原存储布局。
- 默认 prompt / preview 脚本来自当前 API 制品的 dist；非空 `deployment.api.promptDir / previewAssetsDir` 相对配置文件解析。
- 文件缺失、JSON 损坏、新增字段类型错误会报错，错误不输出配置内容。不会自动生成默认文件覆盖数据。
- 旧 JSON 缺少新增段时补内存默认值，不自动改写文件；账号/支付密钥默认留空，须迁移后再使用对应功能。

## 新增字段与原环境变量

| JSON 字段 | 原变量 |
| --- | --- |
| `deployment.publicOrigin` / `basePath` / `dataDir` | PUBLIC_ORIGIN / NEXT_PUBLIC_BASE_PATH / VOCESPACE_DATA_DIR |
| `deployment.api.host` / `port` / `uploadLimitBytes` / `workerEnabled` | API_HOST / API_PORT / API_UPLOAD_LIMIT_BYTES / WORKER_ENABLED |
| `deployment.api.promptDir` / `previewAssetsDir` | VOCESPACE_PROMPT_DIR / VOCESPACE_PREVIEW_ASSETS |
| `deployment.web.host` / `port` / `apiUrl` | HOST / PORT（WEB_PORT）/ VOCESPACE_API_URL |
| `deployment.mobile.apiUrl` / `meetingUiPreview` | EXPO_PUBLIC_API_URL / EXPO_PUBLIC_MEETING_UI_PREVIEW |
| `account.publicUrl` | ACCOUNT_PUBLIC_URL；为空时使用 publicOrigin + basePath |
| `account.supabase.url` / `publishableKey` / `serviceRoleKey` | SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY |
| `account.platformJwtSecret` | PLATFORM_JWT_SECRET |
| `billing.licenseSecret` | LICENSE_SECRET |
| `billing.stripe.enabled` / `secretKey` / `webhookSecret` / `siteUrl` | WEBHOOK / STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / SITE_URL |
| `preview.enabled` / `rendererBaseUrl` / `s3Endpoint` / `maxSources` | PREVIEW_ENABLED / PREVIEW_RENDERER_BASE_URL / PREVIEW_S3_ENDPOINT / PREVIEW_MAX_SOURCES |
| `analytics.enabled` / `url` / `websiteId` | Web NEXT_PUBLIC_UMAMI_* 和 Mobile EXPO_PUBLIC_UMAMI_* |
| `debug.datadogClientToken` / `datadogSite` | NEXT_PUBLIC_DATADOG_CLIENT_TOKEN / NEXT_PUBLIC_DATADOG_SITE |

`livekit`（包含 `turn`）、`redis`、`hostToken`、`s3`、`smtp`、`ai`、`hyperbeam`、RTC 参数、许可证和创建策略保持原 JSON 字段。没有恢复已废弃的 Native 白名单等旧功能开关。旧 `SERVER_NAME` 不再影响客户端链接校验，链接按当前站点及既有允许域名规则解析。

`NODE_ENV`、Node 堆上限、CI/Expo/Next 工具自己的开关、系统 PATH 和 Redis CLI 子进程的认证传递属于框架/工具运行机制，不是另一份应用配置；不需要 `.env` 文件。APT 源与 Redis 备份 hook 是部署工具参数，继续支持原命令行用法。

## 一次性迁移

```bash
pnpm install --frozen-lockfile
node scripts/config.mjs migrate --config /数据目录/vocespace.conf.json \
  --from /旧目录/vocespace.conf.json \
  --env /旧目录/services/api/.env.local --env /旧目录/.env.local
```

按需再传 Mobile/Web 的旧环境文件。多个文件前面的优先，已有 JSON 字段优先于所有旧变量；先备份目标文件，再写入 0600 权限文件。迁移工具不执行环境文件中的 shell 内容、不打印秘密。没有配置过 LICENSE_SECRET 的旧部署显式迁入原来的兼容签名密钥，避免旧许可证突然失效；新安装请自行填写强密钥。

已有配置字段为空时工具不覆盖，必须手动补值。旧 TURN / AI 等会议配置应优先保留原 JSON；JSON 缺少 TURN 时迁移工具可补入旧 TURN_URL / TURN_USERNAME / TURN_CREDENTIAL。检查 `account.publicUrl`、端口和地址是否仍适合目标服务器。完成后旧环境文件可移至安全备份位置，运行时不再使用。

## Web 和 Mobile 的公开配置

Web 服务端读取 JSON，用明确白名单把 analytics / debug / 部署子路径写入页面，不输出 Supabase、Redis、SMTP、LiveKit 管理密钥等秘密。`/api/conf` 原有按权限投影保持不变。客户端代码不能直接导入 JSON 文件或 Node 读取器。

Next 的 `deployment.basePath` 必须在构建时确定：默认构建从 JSON 读取；Ubuntu release 使用只含 basePath 的 `apps/web/vocespace.build.json`；Docker 使用 BuildKit secret 临时挂载配置。运行路径与构建不一致时 Web 拒绝启动。其他公开统计配置从运行时页面读取，修改后刷新页面，不需要重新打包。

Mobile 由 Node 构建适配器向 Expo extra 写入公开字段，通过 Expo Constants 读取。安装包不能读取服务器挂载的文件，因此每次改地址/统计参数后先从唯一 JSON 重新导出：

```bash
node scripts/config.mjs public --config /配置路径/vocespace.conf.json
```

生成 `apps/mobile/vocespace.public.json`，该文件只含公开配置，可随 EAS 上传；它是生成物，不是第二份手工配置源。`app.config.js` 再白名单选择 mobile 和 analytics，不传入整份配置。仓库附带关闭统计的公开默认文件。不要把服务端 JSON 上传到 EAS 或加入 Metro import。

## 修改后的生效方式

Supabase、授权、SMTP、Hyperbeam 等按请求读取。Redis 连接、监听地址、worker 和已建立的媒体/客户端连接应通过重启相应进程生效；不要把“控制台保存成功”理解成所有连接自动重建。API 保持单写入者。手工修改文件后先运行 `node scripts/config.mjs check --config FILE`；它不代替外部服务连接验收。
