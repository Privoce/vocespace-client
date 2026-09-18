# 页面与会话结构

页面入口只调用业务 hook 并选择 Phone / PC 视图。按功能放在 `features/<feature>/hooks` 和 `views`，共享协议与纯逻辑放在功能目录中。视图通过模型类型接收状态与操作，不直接调用业务 API 或修改 store。

`useHomePage` 持有创建/加入表单；`usePreJoin` 持有姓名、设备和媒体预览，委托 `useMediaPermissions` 管理权限。切换视图不会重建这些 hooks。预览的视频 DOM 更换后重新绑定已有轨道，离开预加入组件才释放预览。

布局使用 `useLayoutDevice`：小于 768px 为 Phone，其余为 PC。SSR 快照固定 PC，客户端通过 `useSyncExternalStore` 同步。`DeviceLayoutSync` 将布局桥接到兼容的房间 store；房间、控制栏、子房间、设置、聊天、小部件、后台和录制页都使用同一断点。UA 检测只用于浏览器能力，不作为页面布局开关。

`useRoomEntry` 管理配置加载、平台直入、重新登录和连接凭证；路由按 spaceName 隔离实例。`useRoomConnection` 在会话层持有 LiveKit Room、加密 key provider 和 worker。Room 不放在 Phone / PC 分支内。

`useSocketSession` 在会话或后台边界持有 Socket.IO。客户端模块使用 autoConnect=false；仅导入不会联网，最后一个持有者卸载后断开。服务端 API 通过自定义 server.js 注册的 Socket.IO Server 发通知，不导入客户端页面或创建浏览器 socket。

主动离开由明确的离开意图触发服务端成员清理并返回首页；网络断开不删除成员，不清空重连所需状态。组件卸载释放连接、监听和本地会话状态，服务端异常离线沿用现有 LiveKit/心跳处理。取消 beforeunload 提示不代表离开。

第一阶段不改变子房间权限语义：allowGuest=disable 时预检查阻止游客；link 继续走已有邀请链路，最终权限由服务端判断。

## 第二阶段结构

原路径保留兼容入口和公开类型，页面逻辑迁入以下目录：

| 功能 | 控制器职责 | 视图职责 |
| --- | --- | --- |
| `features/conference` | 会话状态、初始化、事件订阅、成员/媒体订阅、焦点和分页数据 | 稳定房间容器、Phone/PC 媒体区域、轨道与小部件渲染 |
| `features/controls` | 媒体状态与设备选择；设置、管理、录制、AI 与工作模式操作 | PC 工具栏、手机底栏、共同弹层 |
| `features/channel` | 子房间状态、权限与加入/管理操作、反馈提交 | 房间内容、PC 侧栏、手机全屏抽屉 |
| `features/chat` | 草稿、IME、发送/文件操作、未读与滚动 | 共用消息和编辑器；PC 侧栏与手机全屏聊天 |
| `features/settings` | 设置草稿、面板选择、录制查询和媒体设置导出 | 同一面板注册表；PC 标签导航和手机分组导航 |
| `features/widgets`、`features/widget-apps` | 目标用户、AI/待办数据、读写权限和应用更新 | AI 与应用面板；PC 折叠区和手机页签 |
| `features/dashboard` | 后台状态、数据汇总/刷新、管理操作 | PC 侧栏与手机横向导航；共用业务内容 |
| `features/recording`、`features/recording-list` | 搜索竞态、自动查询、文件操作、手机排序与分页 | PC 表格与手机卡片 |

业务控制器在 Phone/PC 分支之上。房间使用 `ConferenceSurface` 固定音频渲染、聊天、控制栏、子房间和小部件的位置，仅替换媒体展示区域。设置和小部件的面板保持挂载，手机导航通过隐藏面板切换，避免丢失草稿、计时状态和 AI 导出引用。共用的稳定容器是这一规则的一部分，不必为了分文件而复制整棵组件树。

`createSocketScope` 只清理当前订阅者注册的监听。房间初始化有独立生命周期，布局/设置变化不重跑初始化，卸载后忽略迟到结果。子房间切换时清空旧组件列表并丢弃旧请求结果。

`useLatestCallback` 用于长寿命订阅和定时器读取最新控制器；`useVisualViewport` 处理手机键盘带来的可视区域变化。手机样式集中在功能目录内，公用安全区、背景、卡片和导航样式位于 `features/shared/mobile.module.scss`，不覆盖 PC 的全局主题。
