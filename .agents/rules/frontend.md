> 路径更新：本文 app/、components/、styles/ 均相对于 apps/web；lib/ 指 apps/web/lib；共用旧模型通过 @vocespace/domain 兼容导出。

# Web 页面、Hook 与会话规范

## 组织与命名

- 参考 `components/Controller/index.tsx`：入口调用一次 `useControls`，Phone / PC 视图接收同一 model；设置与共享弹层保留在稳定的父层。
- 参考 `components/Layout/conference/hooks/`：复杂业务按初始化、事件、成员、媒体和布局拆分；不要把所有副作用塞进一个 hook，也不要为简单 JSX 强行增加层级。
- `use*` 仅用于实际 React Hook；纯规则使用普通函数名。新增函数组件与导出类型明确命名，回调使用类型推断或显式接口，新增边界输入用 `unknown` 后校验。
- 当前代码在 `components/` 和 `app/*/hooks/`，不要沿用旧清单中的 `features/` 路径创建重复实现。局部重构保持原有公共导出兼容。

## 界面与平台

- 布局统一使用 `lib/hooks/use-layout-device.ts` 的 `useLayoutDevice()`，手机阈值以 `lib/layout-device.ts` 为准；SSR 返回稳定 PC 快照。
- 浏览器媒体能力检测与布局判断分开，不能用手机宽度判断屏幕共享、设备切换等能力。
- 样式放模块 SCSS，共用手机基础样式在 `styles/mobile.module.scss`；新增文案进入 `packages/i18n`，`lib/i18n` 保留 Web 上下文与兼容导出。考虑安全区、软键盘、长文本、触控及 IME。
- Phone / PC 只切换表现层。会话、表单、草稿与有状态共享面板在稳定父层持有，避免布局变化重置输入或媒体。

## 生命周期

- `components/Room/hooks/UseRoomConnection.ts` 拥有 Room / E2EE worker；不得在 render、每张预览卡片或每次断点变化时重新创建。
- 普通重渲染、重连与明确退出必须区分；保持 `UseRoomLeave.ts` 和 `lib/roomLeaveIntent.ts` 的退出语义。
- Socket 用 `retainSocket()` 获取/释放所有权；事件使用 `createSocketScope()` 或成对的 on/off，禁止全局 removeAllListeners 清掉其他模块监听。
- Effect 注册的计时器、监听器、媒体轨道与 worker 必须由同一生命周期释放。异步请求使用取消、代次或 active 标记；卸载、换房后忽略迟到结果。
- 不隐瞒 Hook 依赖警告；需要稳定回调时使用项目的 latest-callback 模式，避免陈旧闭包。

## 数据流

Web hook → lib/api 兼容层 → client-sdk。SDK 只处理传输、认证注入和契约；页面跳转、toast、用户权限提示和媒体采集留在端内。UI 是否显示按钮不代表后端已授权。

## 4.2 传输与认证

- 所有 Web API 请求通过 `lib/api/client.ts` → SDK；`apiFetch` 处理会话准备和 host header，不在视图直接 fetch 业务 API。
- 平台 localStorage 只缓存展示信息；通过一次性 code / 服务端 Cookie 恢复身份。不可把 URL 的 data/details 当作认证。重复 Effect 不重复消费 code，消费后移除 URL 中的凭证参数。
- 小文件和大文件统一 HTTP 上传；文件消息仅提交 URL。聊天确认失败应保留草稿并提示，不能静默显示成功。

## Native 首版

apps/mobile 以 Hook / 视图拆分，当前四 Tab：主页、会议、消息、我的；产品名称以 UI 的「首页」为准。消息不实现私信，我的只做本机设置；昵称不是可信身份。后续 RTC / 预览生命周期放在稳定父层，切 Tab 必须取消计时/释放预览，不能同时持有两个正式房间。主持人、开麦/开摄像头、共享或管理录制时切换需确认。

Native 的 src/api 注入安全存储和 SDK，凭证使用按 API 地址隔离的 SecureStore；src/conference/controller.ts 持有唯一正式会话，room.ts 管理 LiveKit/AudioSession。取消、切 Tab、普通后台要释放连接；独立获邀屏幕共享时后台暂停麦克风/摄像头并保留屏幕连接，停止共享后继续清理；清理未完成禁止替换连接。初始连接仅观众；后续发布必须经过独立的主持人邀请与服务端 source 授权，不能把 UI 上的关闭按钮当作服务端禁止发布的依据。

## App UI 主题

用户已指定 App 与 Web 共用主色 #22CCEE。RN 使用 @ant-design/react-native，而非依赖 DOM 的 antd-mobile；按钮、输入、开关、TabBar 优先使用 src/ui/controls.tsx，主题集中在 apps/mobile/src/theme.ts。以 apps/web/app/layout.tsx 的 token 为视觉参考，禁止直接从 Native 导入 Web layout。控件封装只处理样式与无障碍属性，业务仍在 Hook / 控制器；不得把连接所有者下移进 Tab pane。具体映射见 docs/mobile-ui.md。

## 共享会议界面

Web Phone 与 Native 复用 packages/ui/src/meeting 的单份布局、控制栏、聊天、成员和更多面板。用户已于 2026-10-10 确认小范围验证完成并授权扩大迁移；App 默认开启新版，Web 暂保留 meetingUi=shared 对照入口。Ant Design 控件通过统一 props 注入；不要为复用布局改写设备授权或连接生命周期。聊天面板关闭时保留内容挂载与草稿。页面、纯规则和媒体适配分别放置；新范围仍需独立回归，不把原试验确认当作未来高级工具或真实设备的验收。嵌入播放器在分页与焦点切换时保持挂载，不能因抽公共布局重建连接或播放器。

2026-10-11：Native Space 纵向浏览目前仅为允许访客的业务 Space 信息卡和手动加入，不能称为实时预览或自动加入。Room 横向切换复用退出确认与唯一会话控制器；短拖、回拖、取消确认不换房。设备列表读取来自本机 LiveKit/AudioSession，不能依赖高级设置快照读取成功。Ant Design Native Input 焦点补丁由 pnpm patchedDependencies 固化，更新控件版本前重新验证键盘隐藏不抢焦点。

2026-10-11 发现更新：取消 Native env 白名单，打开列表/返回前台/浏览停留时刷新；卸载取消请求和计时器，刷新不得创建正式成员或开启媒体。Web 私密 Room 发布者对 native_ 服务端身份拒绝全部轨道订阅，Web 对 Web 保留原规则。见 docs/native-space-discovery.md。

2026-10-11 当前交互更新：手动 Space 输入在首页；会议 Tab 纵向 HLS 预览主会场（全部子 Room 排除），首帧后连续有效播放 15 秒或点击按钮才正式加入。预览 Hook 持有唯一 expo-video player，正式 RTC 前卸载媒体；拖动/切 Tab/非 active AppState 立即取消，迟到 lease 要释放。本机 autoJoin 与 previewMuted 生效。新增原生模块必须重建 development build；不能以 Expo JS 导出宣称 HLS 真机通过。
