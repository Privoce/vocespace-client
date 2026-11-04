# Platform

从 `vocespace_platform` 迁入的账号门户，工作区名为 `@vocespace/platform`。原项目保留不动；这里不包含其 `.env`、密钥或旧业务 API。

根目录执行 `pnpm dev:platform`，访问 `http://localhost:3002`。独立 API 使用 `pnpm dev:api`，会议 Web 使用 `pnpm dev:web`。

生产构建与启动：`pnpm build:platform`、`pnpm start:platform`。配置统一读取根 `vocespace.conf.json`，或启动时传入 `--config /绝对路径/vocespace.conf.json`。

配置、权限与部署说明见 [迁移说明](../../docs/platform-migration.md)。Platform 不再提供旧 `/api/token` 等业务路由；Next 只保留 Supabase 登录回调，`server.mjs` 将 `/api/platform/*` 代理到独立 API。

保留原 Next 14 / React 18 / Ant Design 5 运行时；未进行框架升级。`tsconfig.json` 将 React 类型限定到本工作区，Webpack 同步固定 React、Ant Design 及图标的运行时包路径，防止 pnpm 共享依赖声明误用 Web/Native 的 React 19 类型。
