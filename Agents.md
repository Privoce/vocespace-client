# VoceSpace 开发规范入口

本文件是项目规范索引，具体规范维护在 `.agents/rules/`。开始修改前阅读相关规则；以当前代码和用户最新要求为准，规划文档中的未来结构不能当作现状。

| 规则 | 适用范围 |
| --- | --- |
| [目录与架构边界](.agents/rules/architecture.md) | 所有代码修改、共享库和前后端迁移 |
| [Web 与会话规范](.agents/rules/frontend.md) | 页面、Hook、Phone/PC、媒体与 Socket 生命周期 |
| [服务端与数据规范](.agents/rules/backend.md) | API、授权、数据、配置、任务和发现流 |
| [开发与验收规范](.agents/rules/verification.md) | 代码风格、测试、构建、回归与状态记录 |

实施进度见 [checklist.md](checklist.md)，阶段 4 现状和迁移依据见 [架构盘点](docs/stage-4-baseline.md)。总体目标见 [app_plan.md](app_plan.md)，发现流细节见 [app_直播.md](app_直播.md)。

当前执行顺序以用户 2026-10-09 的决定为准：pnpm monorepo → RN 四 Tab / 会议闭环 → 滑动预览与延迟加入 → 独立部署与综合验收。Umami、新用户体系、私信和商业化后置。消息/我的只做入口与本机设置；主持人或发布媒体/共享/管理录制时滑走需确认。

当前结构和启动方式见 [Monorepo 首批迁移](docs/monorepo-first-batch.md)。Web 页面位于 apps/web；API 入口为 services/api/entry.ts，构建产物 services/api/dist。根 lib 暂为旧兼容层，不是 Native 共享库。Web 不再启动 API 子进程，分别使用 pnpm dev:web / pnpm dev:api。后端认证和数据规则沿用 [4.2 交付说明](docs/stage-4-b2.md)，文中的旧源码/构建路径以新迁移说明为准。

Native 手动观众试运行见 [4.4 当前交付](docs/native-observer-pilot.md)。该功能默认关闭，仅限显式配置的无子房间测试 Space；不能当作公开发现或延迟加入已经完成。
