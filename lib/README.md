# lib 公共接口

P1 起，lib 只承载可复用能力。业务 API、权限、配置模型和 Zustand 状态位于 features，文件、Redis、JWT、邮件和 AI 服务实现位于 server。没有全局 lib/index.ts。

## 入口与使用环境

| 入口 | 内容 | 使用环境 |
|---|---|---|
| `@/lib/utils` | 字符串校验、房间 ID 编解码、颜色、URL、JSON、模糊半径计算 | 纯函数；服务端和客户端 |
| `@/lib/types/common` | Option、Size、SizeNum | `import type` |
| `@/lib/http` | src、connect_endpoint、createApiUrl | 路径拼接；服务端调用相对 URL 时显式传 origin |
| `@/lib/browser` | 环境检测、下载文件/Markdown | 导入可用于 SSR；下载操作只能在浏览器事件中调用 |
| `@/lib/browser/window` | ViewAdjusts、isAdjustWindowWhen | SSR 可调用；响应式宽度由调用方提供 |
| `@/lib/browser/media` | loadVideo、hasHeadphonesConnected | 浏览器设备能力，调用方负责所获流的释放 |
| `@/lib/browser/performance` | PerformanceDetector | 导入安全；检测操作需要浏览器/GPU |
| `@/lib/hooks` | useDebounce、useThrottle、useVideoBlur | React 客户端组件；效果不会在 SSR 执行 |
| `@/lib/components` | DeviceList、PaginationCtl、PaginationInfo、mergeProps、ToggleProps | 通用 React 组件/属性；不读业务 store |
| `@/lib/livekit` | DevicesSelector、设备/连接类型、isVideoCodec | LiveKit 客户端适配，无产品权限或具体业务请求 |
| `@/lib/livekit/connection` | 连接类型、isVideoCodec | 服务端需要连接类型时使用 type import，避免引入 UI barrel |
| `@/lib/i18n/i18n` | 国际化 Provider、useI18n、Trans | 沿用中英俄国际化设施 |

`lib/types.ts` 是历史连接类型兼容入口，优先级高于同名目录；新的基础类型明确从 `lib/types/common` 导入。它也转导出基础类型，避免同名入口产生不同类型定义。

## 组件约定

DeviceList 接受 items、activeValue、onSelect 和可选 emptyLabel，选择状态由调用方管理；设备枚举、权限申请和轨道切换由 lib/livekit 的 DevicesSelector 适配。保持原设备列表尺寸、间距和按钮样式，按钮不会提交所在表单。业务文案可通过 emptyLabel 注入。

Pagination 的 tracks 为泛型，不依赖 LiveKit 轨道类型；PaginationCtl 只要求翻页回调和总页数。分页 SCSS 随组件存放，旧样式文件暂保留供 P8 清理检查。

只在客户端事件或 effect 中调用浏览器能力。订阅必须解绑自己的 handler。useVideoBlur 在卸载和依赖变化时断开观察器、移除事件、取消待执行动画；loadVideo 的完整取消/轨道所有权将在 P2/P4 继续统一，不应把该历史接口当作会话管理器。

## 检查和迁移

运行 `pnpm check:boundaries`、`pnpm typecheck`、`pnpm test` 和 `pnpm lint`。边界检查禁止 lib 对 app/features/server 的依赖（包括类型），并检查客户端可达的服务端运行时依赖。纯工具禁止 React、LiveKit、DOM 和网络。

导出按能力域组织。通用组件通过回调暴露行为，业务层处理路由、产品埋点、权限和状态。跨 feature 使用其公开的 api/model/types/store 或指定 hooks 文件，不从视图内部导入实现。

完整迁移对照、六个历史入口和已知限制见 [P1 迁移说明](../docs/p1/migration.md)。
