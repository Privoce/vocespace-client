# 2026-10-22 反馈关闭方式与组件清理

## 关闭方式

Native 反馈弹窗使用公共 `MeetingSheetHeader` 的右上角 X，取消底部按钮栏，表单内容独立滚动，提交按钮留在表单内。`SettingsDialog` 新增可选 `closeInHeader`，其他需要取消/确认的设置弹窗保留原行为。Web 反馈弹窗也只使用右上角关闭，不增加底部取消按钮。

## 统一与删除

对 `apps/mobile/src`、`apps/web/components`、`packages/ui/src` 的组件及其调用关系进行检查：使用 TypeScript 模块解析检查静态/动态导入和导出，再通过全仓符号搜索确认；包入口、框架入口、端内适配器和仍有调用的兼容分支不按零引用直接删除。

Web Channel 的 PC / Phone 反馈统一使用 `components/Feedback` → 公共 `FeedbackForm`，删除旧表单、Hook、状态、上传列表类型与专用样式。邮箱、验证、上传、提交和失败草稿只维护一份；这取代上一轮保留 PC 独立反馈表单的安排。

删除 11 个文件：

| 文件                                                       | 原因 / 当前实现                                            |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/mobile/src/chat/ConferenceChat.tsx`                  | 被 `SharedConferenceChat` + 公共 `MeetingChat` 替代        |
| `apps/mobile/src/screens/MessagesScreen.tsx`               | 未使用的旧消息占位页，App 没有挂载                         |
| `packages/ui/src/meeting/MeetingAvatar.tsx`                | 未导出的旧模拟形象，当前使用 InitialAvatar / 端内 AVO      |
| `apps/web/components/Channel/hooks/useChannelFeedback.tsx` | 重复反馈逻辑已统一到共享表单及 Web 适配器                  |
| `apps/web/components/Settings/pc.tsx`                      | 未调用的重复 Tabs 包装，当前由 Settings/index 维护稳定面板 |
| `apps/web/components/Widgets/reaction.tsx`                 | 无调用的旧反应面板，现有举手流程不依赖它                   |
| `apps/web/components/PreJoin/custom.tsx`                   | 已标记弃用且无调用的自定义连接表单                         |
| `apps/web/components/Toggles/Setting.tsx`                  | 无调用的旧设置开关                                         |
| `apps/web/components/Select/status.tsx`                    | 无调用的旧状态选择器                                       |
| `apps/web/components/Layout/carousel.tsx`                  | 无调用的旧轮播布局                                         |
| `apps/web/components/Participant/name.tsx`                 | 无调用的旧名字截断组件                                     |

同时移除 Native `useMeetingRoom` 中无消费者的分页、固定聚焦及自动聚焦屏幕状态；这些职责已经由公共 `usePhoneMeeting` 管理。轨道筛选、真实媒体订阅、举手和设备授权保持端内所有权。

保留 Web `ControlsPhone` 对照分支，因为仍由显式分支调用；保留 Web/Native 图标、媒体、输入和弹层适配，因为它们调用公共定义而不是重复实现业务。未扩展到未验证的后端、数据文件或构建制品清理。

## 验证

- 根 / Mobile / UI 类型、共享包边界、253 项测试通过。
- Native 状态清理后追加 21 项共享会议 / 持续举手回归通过。
- 相关 Web lint 无错误，已有 Hook / img 警告保留。
- 隔离副本标准 API / Web 生产构建及 iOS / Android JS 导出通过。
- `git diff --check` 通过；原生弹窗在软键盘开启时的视觉效果仍待真机回归。

## 开发服务恢复

验证期间误在工作区启动构建，造成开发缓存失效及页面 500。用户随后明确授权重启 3000 端口 Web：已停止旧 Web 进程，将受损 Webpack 缓存移至临时备份并重新启动。首页、`/labs/meeting-ui` 均返回 200，`/healthz` 返回 ok，重新编译日志没有此前的缓存缺失异常。API 与数据库未重启。

## Web Phone 设置导航对齐

用户截图暴露了未统一的内容适配：公共导航壳接收了 Web PC 的 `TabItem`（`justify-content: space-between`、14px 图标），而 Native 传入另一套左对齐的 JSX，导致公共外壳内仍有两种布局。

现由 `PhoneSettingsNavigation` 维护固定图标槽、14px 间距、左对齐文本及独立右箭头；`meetingSettingsSections` 维护图标映射，两端仅传入图标节点和纯文案。Web / Native 图标为 20px，箭头为 16px。PC TabItem 保持原有样式。预览改用真实 SettingsPhone 适配器，不再手工拼装另一套导航内容。

根 / UI / Mobile 类型、边界、12 项设置专项和相关 lint 通过；390×844 浏览器检查确认文字位置及 20×20 / 16×16 图标尺寸。未进行新的真机视觉验收。
