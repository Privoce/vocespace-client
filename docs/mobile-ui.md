# App UI 与 Web 主题对齐

按 2026-10-09 用户要求，App 延续 `apps/web/app/layout.tsx` 的 `#22CCEE` 主色，并使用 Ant Design 的原生组件实现界面。

## 组件库与平台

`apps/mobile` 保持 Expo / React Native，采用 `@ant-design/react-native@5.4.3`；网页端的 `antd-mobile` 依赖 DOM，不能直接放进 Native 视图。原生库来源：[Ant Design React Native](https://github.com/ant-design/ant-design-mobile-rn)。Web 继续使用现有 `antd`。

按钮、输入框、开关、TabBar、Provider 和图标已接入。字体由 Expo Font 从本地打包资源加载；手势、Reanimated 和 Worklets 版本与 Expo 55 配套。增加原生依赖后需要重建 development build，旧客户端热更新 JS 不足以完成升级。

## 主题映射

主题集中在 `apps/mobile/src/theme.ts`，不从 Web layout 导入 Next / React DOM 代码。

| Web 定义 | App 对应 | 值 |
| --- | --- | --- |
| colorPrimary / Segmented.itemSelectedBg | brand_primary、主按钮、选中 Tab、开关、输入边框 | #22CCEE |
| Input.colorBgContainer / Segmented.trackBg | 表单、卡片和 TabBar 背景 | #1E1E1E |
| colorText | 正文 / color_text_base | #AAAAAA |
| Input.colorTextPlaceholder / Button.defaultColor | 次级文字和占位符 | #8C8C8C |
| colorTextDisabled | 禁用文本 | #333333 |
| borderRadius | 表单和按钮控件圆角 | 4 |
| Segmented.itemSelectedColor | 主按钮文字 | #1E1E1E |

页面仍保留适合触屏的间距、至少 48 高的输入区域及 60 高的 TabBar。卡片圆角属于页面容器，不与表单控件圆角绑定。

## 维护规则

`src/ui/controls.tsx` 只封装 Ant Design 组件的共同样式和无障碍属性，按组件路径引入，避免无关的旧组件进入 bundle。业务仍位于页面 Hook / conference 控制器中。

TabBar 使用受控选中状态；切离会议前仍等待原控制器完成退出。连接、设置及凭证持有者位于 TabBar 上方，不因组件库切换重新创建。主色、输入框和按钮样式应从主题/控件入口获取，不在页面重新硬编码。

消息和我的仍限于入口与本机偏好。预览静音和自动加入只保存偏好，预览功能尚未开放。

## 本批验证

Native / 全项目类型检查、依赖边界、70 项现有测试、iOS/Android JS 导出通过。新增原生依赖后 iOS Debug development build 编译成功；iPhone 17 / iOS 26.2 模拟器实际验证青色首页、图标字体、会议输入与禁用态、Tab 切换、设置开关和昵称跨 Tab 更新。测试昵称和开关已恢复原值。Android 本批仅验证 JS 导出，未执行原生编译或真机媒体验证。

会议内聊天沿用 Ant Design Native 的输入与按钮，展示 Web/App 共用的会议消息；它独立于底部「消息」Tab。界面与控制器位于 `apps/mobile/src/chat`，不把 Socket 所有权放进页面。新增联调证据见 [会议聊天交付](native-conference-chat.md)。

## 原生会中页面（2026-10-10）

`src/conference/MeetingRoom.tsx` 负责会中视图，`useMeetingRoom.ts` 组织画面/成员/聊天、固定画面和举手状态；唯一 RTC、聊天、设备控制器仍由稳定 App 层拥有。视频区使用 LiveKit 原生 VideoTrack，控件使用 Ant Design Native，未导入 Web DOM 组件。操作栏独立于滚动区，聊天增长不会把退出按钮推到屏幕之外。参照 PC 的功能结构，不把录制、AI、文件、白板等 Web 工具标为已移植。新界面的真机排版与交互仍需回归。

## 共享界面试验（2026-10-10）

共享组件统一位于 packages/ui（2026-10-11 合并原 meeting-ui 包），使用 RN primitives；Web 通过 react-native-web 渲染同一份布局。Ant Design 按钮由消费者按统一 props 适配，仍采用 #22CCEE。用户已确认试验并授权扩大迁移。App 默认使用新版会中界面，Web 保留对照参数入口；顶栏、卡片、控制栏、聊天、成员与更多面板共用，四 Tab 保留。详见 [扩大迁移说明](shared-meeting-ui-migration.md)。
