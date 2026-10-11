# Monorepo 收尾（2026-10-11）

本批执行 domain 优化 → 根 lib/依赖归属 → 独立部署 → Next 取舍。继续使用 pnpm，不添加 Lerna。

## 目录与边界

| 路径 | 当前职责 |
| --- | --- |
| apps/web/lib | Web Hook、store、设备/媒体工具、SDK 兼容 API、语言 Provider；server/api-proxy 仅同站转发 |
| services/api/lib | 配置、Redis、文件、业务兼容服务、平台验签、邮件、AI、S3 清理 |
| services/api/realtime、worker、preview | API 同进程 Socket、任务调度及 Egress 模板/出口模块 |
| services/api/prompt | 构建时复制到 API 制品的提示词资源 |
| packages/domain | 共用旧模型、默认值、纯规则及旧请求形状；详情见包内 README |
| packages/contracts | 新 JSON DTO/校验，以及旧身份格式函数；不包含白名单授权 |
| packages/server-core | 端口注入业务服务与创建白名单规则 |
| lib/uploads/S3_clean.json | 保留的旧清理队列数据位置；根 lib 已无源码 |

Web 的 @/lib 现在只指向 apps/web/lib。服务端使用相对路径和共享包，不反向导入 Web 的 API 类型。Web 保留 std 等兼容导出，真正共用的实现只有 domain 一份。所有 PC/Phone 组件表现保持原逻辑，仅调整引用。

根 package.json 不再包含运行 dependencies，devDependencies 用于统一检查和测试（测试明确依赖 React、Ant Design、Next、AWS mock 等，不能把这些误认为 Web/API 运行依赖）。每个工作区声明自己的直接依赖，check:boundaries 检查声明、跨端引用和共享库边界。API 新增独立 typecheck。

## 数据和部署兼容

没有移动或重置开发环境的配置、上传、sql、清理队列或 Redis key。API 仍默认使用仓库根数据；生产通过 VOCESPACE_DATA_DIR 指向独立挂载。迁移的是源码，不是数据格式。Socket、worker 保持单 API 所有权，不能多实例共享本地文件写入。

新的 Dockerfile 具有 web/api 两个目标，Compose 可使用外部 LiveKit/Egress/Redis；旧一体化 entrypoint 已停用，避免继续改写配置及前端产物。安装与回退见 [独立部署](independent-deployment.md)，框架结论见 [Next 取舍](next-web-decision.md)。

## 验证记录

- pnpm check:boundaries、根/API/Mobile/UI 类型检查通过；iOS/Android Expo JS 导出通过。
- 32 个测试文件、175 项测试通过，包括 PC/Phone DOM/控件保留测试。
- 在独立安装依赖、排除本机环境和数据的临时副本中，标准 pnpm build 通过；保留既有非阻断 Hook/图片 lint 警告。
- Web standalone 和 pnpm deploy 的 API 生产包分别启动，144 项 HTTP/Redis/Socket 集成通过（媒体/S3 使用本地模拟）。
- check:deployment 验证显式开启、必填参数、首次初始化、文件权限、重启与已有文件保护；Compose config 和安装技能校验通过。
- 远程 CI、双架构镜像、生产部署和真实音视频链路仍需分别验收，不能从制品构建推断通过。

Docker 验证限制：已启动本机 Docker Desktop，构建停留在 Docker Hub 基础镜像元数据下载；90 秒限时重试超时，未进入项目容器编译。因此不勾选实际镜像构建/启动；Node 独立制品验证已完成，远程 CI 尚未运行。
