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

当前结构和启动方式见 [Monorepo 首批迁移](docs/monorepo-first-batch.md)。Web 页面位于 apps/web；API 入口为 services/api/entry.ts，构建产物 services/api/dist。根 lib 源码已分别移入 apps/web/lib、services/api/lib、packages/domain，仅保留 lib/uploads 旧数据位置。Web 不再启动 API 子进程，分别使用 pnpm dev:web / pnpm dev:api。后端认证和数据规则沿用 [4.2 交付说明](docs/stage-4-b2.md)，文中的旧源码/构建路径以新迁移说明为准。

Native 手动观众试运行见 [4.4 当前交付](docs/native-observer-pilot.md)。该功能默认关闭，仅限显式配置的无子房间测试 Space；不能当作公开发现或延迟加入已经完成。

Native 会中邀请与设备控制见 [会中交付](docs/native-meeting-controls.md)：初始观众令牌不变，受 Web 主持人邀请后通过独立 API 授权指定麦克风/摄像头；设备采集由用户主动触发。新增会中 UI 与真机采集尚待回归，不能把 JS 导出视为设备验收。

2026-10-10 共享会议 UI 试验见 [验证说明](docs/shared-meeting-ui-pilot.md)：采用 RN primitives + react-native-web，Web/App React 对齐 19.2.0，Web Next 15.5.27。用户已确认小范围验证完成并授权扩大迁移；App 默认开启新版，Web 保留参数对照入口。当前范围及待验收项见 [扩大迁移](docs/shared-meeting-ui-migration.md)，连接、权限和媒体实例留在端内适配器。

共享房间设置见 [设置交付](docs/shared-room-settings.md)：以原 Web Phone 的 DOM、SCSS、文案和 SVG 为基准，PC 保留原分支。Phone 十类子面板及 AVO/虚拟形象/AI 分析/录制卡片/证书弹窗的布局提取至 packages/ui/src/meeting/settings；中英俄词典归 packages/i18n，原图标归 ui/settings-icons。Native 语言可本机保存；只读设置 API 仅投影已确认成员的自身偏好和权限表，不开放管理写入。AVO 动画、导入导出/保存、设备高级能力及录制/证书管理仍需 Native 适配，不能把组件呈现当作功能授权或真机验收。新增 react-native-svg 后需重建 development build。

2026-10-10 最新状态与后续顺序见 [checklist](checklist.md) 和 [后续实施计划](docs/mobile-next-steps.md)：用户基本确认 Mobile 设置/图标；只读设置 API/SDK/App 调用已有实现，但当前环境读取失败，原因未定位，设置联调与高级功能暂缓。不得表述为真实数据已验收。后续优先会议核心回归、发现/预览与延迟加入；本次仅规划，不关闭已有请求或填充假数据。

2026-10-11 输入/设备与双向导航见 [最新交付](docs/mobile-navigation-controls.md)：Native 试运行扩展至部署显式配置的多个 Space 及公开子 Room；不再要求无子房间，仍拒绝私密 Room。恢复新建 Space 默认两个 Room；纵向仅受控信息浏览与手动加入，真实预览/自动加入未完成。屏幕单独邀请授权，iOS 广播扩展已编译；共享后台暂停麦克风/摄像头并保留屏幕连接，普通后台仍退出。真机采集与新导航待用户回归。

2026-10-11 最新范围见 [Native 全量发现](docs/native-space-discovery.md)：用户已要求取消 env 白名单，全部允许访客的业务 Space 可发现/手动加入，旧 NATIVE_CONFERENCE_SPACE(S) 忽略。存在私密 Room 不再排除整个 Space；Native 仅进入主房间/公共 Room，Web 发布端限制私密轨道订阅。Web 私密 Room 创建和管理保持原行为。此条取代前文测试 Space 范围，真实预览/自动加入仍后续处理。

2026-10-11 主会场预览见 [预览交付](docs/native-space-preview.md)：手动加入移到首页；会议 Tab 使用独立 HLS，连续有效播放 15 秒或点击加入才连接正式 RTC。用户指定直接输出主会场，排除全部子 Room，替代原主持人单轨默认方案。Egress 专用模板、租约网关与任务清理已实现，部署开关默认关闭；真实 Egress/设备播放仍待回归，不以 JS 导出或模拟服务代替。

2026-10-11 UI 包合并：原 packages/meeting-ui 已并入 packages/ui/src/meeting，Web/Native 统一依赖 @vocespace/ui；内部基础类型、主题与图标和会议/设置目录分开组织。meeting-core 保留无 UI 的纯规则。参见 [UI 包说明](packages/ui/README.md)。

2026-10-11 Monorepo 收尾见 [迁移说明](docs/monorepo-cleanup.md)：domain 承接旧共用模型，白名单归 server-core；根依赖仅用于工具/测试。Web/API 两个 Docker 目标与安装流程见 [独立部署](docs/independent-deployment.md)，安装技能位于 skills/vocespace-install/SKILL.md。Next 暂时保留，理由见 [框架取舍](docs/next-web-decision.md)。容器/真实部署的待验收状态以 checklist 为准。

2026-10-11 Native 创建与设置接口已接入，见 [服务端对齐](docs/native-service-parity.md)：创建者凭据绑定 Native 会话，确认入会后获取房主管理与主动采集权限；其他成员仍遵循观众授权。设置允许自身偏好写入及房主房间策略/RBAC/应用配置，录制文件按权限读取/下载/删除；禁止通过 legacy 路由绕过专用 Native 授权。视频特效/屏幕共享音频等平台能力与接口保存分开验收；部署管理员、AI 密钥、证书、订阅能力未因房主身份开放。
