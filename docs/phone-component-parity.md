# Mobile / Web Phone 组件复用盘点（2026-10-20）

本轮以已有 Web Phone 为基准。PC 组件分支保持原样；Web layout 仅将两个同值颜色常量改为共享主题引用。

| 范围 | 当前共用部分 | 端内适配职责 |
| --- | --- | --- |
| 创建/加入 Space | `ui/content` 中的首页表单结构与 i18n | Web 路由与 Native 创建/加入流程 |
| 会议与抽屉 | PhoneMeeting、MeetingSheet、MeetingDock、MeetingShare | Web DOM 弹层与 Native Modal / 安全区 |
| 聊天、成员、更多 | MeetingChat、MeetingMembers、MeetingMenu、MeetingControls | 消息传输、成员管理权限与设备动作 |
| 十类设置与 AVO 编辑器 | `ui/meeting/settings` 的内容结构、SVG 和词典 | 表单草稿、API 保存、系统设备、录制文件等 |
| 图标（本轮统一） | `meetingIconSource`：会议图标到现有 Web SVG 资源的单份映射 | DOM SVG 与 react-native-svg 节点渲染 |
| Tile 工具（本轮提取） | MeetingParticipantTools：放大/全屏/形象/应用顺序、标签与能力入口 | 平台全屏、设置跳转、应用数据 |
| 持续举手（本轮提取） | MeetingRaisedHand：本人可放下，其他成员只读；覆盖普通/紧凑 Tile 和 Native 全屏 | 鉴权写入、刷新成员目录、Web 原主持人处理流程 |
| 按钮（本轮统一） | `phoneButtonColors`、`meetingButtonVisual` | Ant Design Web / Native Button 的属性、触摸与无障碍适配 |

新组件、类型和运行时入口同步导出。纯主题另提供 `@vocespace/ui/theme`，供 Next 服务端 layout 使用，避免通过组件总入口引入客户端 Hook。

## 举手状态核查

现场服务进程启动于 21:41–21:47，早于上一轮举手状态持久化实现。旧 Socket 服务可以确认通知已发送，却不会把 raiseHand 写入目录，因此无法呈现持续标记。需要重启 API 加载实现；不通过本机假状态掩盖这个差异。

App 现在在 Socket 确认后重新读取成员目录，确认服务端状态与请求一致后才提示成功。Toast 关闭不影响举手状态；放下失败保留标记。共享标记放在媒体、元数据之后，并明确设置覆盖层级。Native 全屏此前没有该标记，本轮补齐。

沿用 Web Widgets/raise.tsx 的 RaiseKeeper 语义与同一 hand SVG。Web 的主持人接受/拒绝处理和 API 权限边界保留；举手本身不授予麦克风权限。

## 按钮对齐

- Web 主操作使用 #22CCEE 实心背景和白色文字；Mobile 创建/加入按钮的文字、设置中保存状态/显示名称/权限/AVO 预设及 AI/证书主操作已对齐。
- 默认按钮使用 Web 默认按钮颜色；选项按钮使用 Web Phone 的深色选项背景，选中状态用主色文字。删除操作使用危险色。
- 会议工具/图标/操作卡片使用同一颜色计算函数。禁用与权限条件仍由原业务适配器决定。

## 本轮验证

- 218 项单元、Hook、组件测试通过，包括举手在提醒消失后持续、放下失败保留状态、旧服务只确认事件时不误报成功、全量会议图标渲染、工具能力入口和按钮禁用行为。
- 根、Mobile、UI 类型检查、工作区边界与本轮相关 Web lint 通过。
- iOS / Android JS 导出通过，不代表原生或真机验收。
- 浏览器静态 Phone 预览已验证举手标记在左上角出现、点击后消失；保存按钮实际计算背景为 rgb(34, 204, 238)，文字为白色。
- 本轮未改动后端写入逻辑，上一轮的 187 项隔离后端检查作为历史证据；未连接用户真实会议。需重启 API、重新加载 App 后回归跨端持续举手、全屏和设置按钮。
