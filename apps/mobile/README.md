# VoceSpace Mobile

独立 React Native / Expo development build 子项目。使用根 `.nvmrc` 和 pnpm workspace。当前三个 Tab 为首页 / 会议 / 我的，消息暂时隐藏；Supabase 账号、资料与会议页面已有实现。

已接入访客 Bearer、安全存储、LiveKit 会议与权限控制，以及 HLS 预览 / 10 秒有效播放后加入。真实服务和设备验收独立记录，当前进度见 [checklist](../../checklist.md)。本批修复后暂停新增功能，转入测试发布；构建、原生模块更新、签名和商店测试见 [mobile_build.md](../../mobile_build.md)，服务器部署见 [linux_deploy.md](../../linux_deploy.md)。

- `pnpm dev:mobile`：启动 Metro，使用已安装的 development build。
- `pnpm --filter @vocespace/mobile ios` / `android`：生成、构建并安装原生开发客户端，需要对应原生工具链；不能使用 Expo Go。
- `pnpm typecheck:mobile`：Native 类型检查。
- `pnpm --filter @vocespace/mobile export`：iOS/Android JS 导出，不等同于原生编译或实际媒体互通。

API 地址通过 `apps/mobile/.env.local` 的 `EXPO_PUBLIC_API_URL` 配置，参考 `.env.example`。生产要求 HTTPS；手机和模拟器必须能直达 API 与 LiveKit。

页面位于 `src/screens`，偏好 Hook 位于 `src/settings/hooks`。`src/conference` 的控制器由 App 稳定父层持有，`src/api` 注入安全存储和共享 SDK。Native 不导入根 lib、Web 或服务端代码。凭证使用 SecureStore，非敏感偏好使用 AsyncStorage。

Expo 55 / RN 0.83 / React 19 与 Web React 18 分开解析。LiveKit RN 3.0.0、WebRTC 144.2.0、livekit-client 2.22.3 及 Expo 插件版本固定在 package.json / lockfile。`ios`、`android` 是被 Git 忽略的 Expo CNG 生成目录；通过 app.json / config plugin 维护原生配置。

UI 使用 `@ant-design/react-native`（Ant Design 原生版），沿用 Web 的 `#22CCEE` 主色；按钮、输入、开关和 TabBar 经 `src/ui/controls.tsx` 与 `src/theme.ts` 统一管理。字体随包加载，手势/动画依赖变更后需要重建原生客户端。详见 [App UI 规范](../../docs/mobile-ui.md)。

会议聊天位于 `src/chat`，控制器同样由稳定 App 层持有，只在确认入房后连接。最近 50 条消息与 Web 共用存储；失败保留草稿，重试去重，重连补历史。消息 Tab 仍不是私信。详见 [聊天与隔离联调](../../docs/native-conference-chat.md)。

iOS 模拟器也需保留正常的构建签名；不要使用 `CODE_SIGNING_ALLOWED=NO` 验证 SecureStore。该无签名构建虽然能显示页面，却可能缺少钥匙串 entitlement。Xcode 的模拟器 ad-hoc 签名不要求真机开发者证书。

会中页面参照 Web PC 的视频、成员、聊天和操作栏组织，保持原生实现。现在支持举手、接受 Web 主持人的麦克风/摄像头邀请、开关设备和会中退出确认；初始仍以观众进入。需要更新并重启 API，同时重新加载 Metro；本批没有新增原生依赖，无需仅为此批重新 prebuild。功能与回归步骤见 [Native 会中交付](../../docs/native-meeting-controls.md)。真实设备采集及音频路由尚待验收。

会中统一使用公共会议界面，不再提供版本开关或旧版分支；与 Web Phone 共用顶栏、卡片、控制栏、聊天、成员和更多面板，详见 [扩大迁移](../../docs/shared-meeting-ui-migration.md)。新 UI 不扩大服务端开放范围或设备权限。

## 会中设置与语言

设置使用 Web Phone 的公共内容布局、原 SVG 和 `@vocespace/i18n` 中英俄词典。切换语言会立即更新设置并保存到本机。加入确认后读取自身偏好与权限表，需要 API 包含 `/api/v1/native/settings`。

本次新增 `react-native-svg@15.15.3`，更新后运行 `pnpm --filter @vocespace/mobile ios`（或 `android`）重新生成 development build；仅 Reload 不会安装该原生模块。详情、能力边界和回归步骤见 [共享设置交付](../../docs/shared-room-settings.md)。

如果设置图标出现红底字母 `U`，这是 React Native 的 `Unimplemented component` 原生组件占位提示在小尺寸下被裁切，需检查当前开发客户端是否已包含 `RNSVG`。在 Metro 已运行时，可执行 `pnpm --filter @vocespace/mobile exec expo run:ios --no-bundler` 更新 Pods、重建并安装模拟器客户端；清理 Metro 缓存不能补齐缺失的原生组件。

若 Xcode 日志出现 `x86_64-w64-mingw32-gcc` 和不识别 Objective-C 编译参数，检查终端继承的 `CC` / `CXX`。本机曾配置 Windows 交叉编译器；可仅对本次命令移除覆盖：`env -u CC -u CXX pnpm --filter @vocespace/mobile exec expo run:ios --no-bundler`，不必修改全局编译环境。

新增 workspace 包后，如果 Metro 提示 `Unable to resolve "@vocespace/i18n"`，先在原终端按 Ctrl+C 停止 Metro，在仓库根目录运行 `pnpm install --frozen-lockfile`，再运行 `pnpm --filter @vocespace/mobile exec expo start --dev-client --clear`。Expo 在启动时收集各 workspace 包的监听目录，运行中的 Metro 不会通过 App Reload 重新收集新增包。纯 JS 包解析问题无需重新编译 iOS；上面的 SVG 原生模块安装仍需 development build。

### 2026-10-11 会议发现更新

会议列表自动发现当前服务允许访客的 Space，不再配置 `NATIVE_CONFERENCE_SPACE` / `NATIVE_CONFERENCE_SPACES`。私人 Room 不出现在 App 目录中，但主房间与公共 Room 可以加入。重启 API、刷新 Web 会议页、重新加载 App 后验证。现有信息浏览不包含实时预览和自动加入。详见 [发现交付](../../docs/native-space-discovery.md)。

2026-10-11：手动加入已移到首页，会议 Tab 支持主会场 HLS 预览，连续有效播放 15 秒或点击加入后进入。新增 expo-video，需要重新构建 development build。Egress/API/S3 配置与待回归项见 [Space 预览交付](../../docs/native-space-preview.md)。

首页「创建/加入会议」复用 Web new_space 的说明、输入提示与按钮词条；支持 Space 名称及会议链接。首页输入不存在的 Space 会按服务端创建策略新建；创建者确认入会后拥有房主设置与主动采集权限，详见 [接口接入](../../docs/native-service-parity.md)。

## Hook 文件组织

与 Web 的模块内 `hooks/` 方式一致，`useXXX.ts` / `useXXX.tsx` 一律放在所属目录下的 `hooks/`，调用方直接引用对应文件：

- `src/account/hooks/`：账号、登录表单和个人页面。
- `src/chat/hooks/`：会议聊天。
- `src/conference/hooks/`：会议、设备、设置、发现与预览。
- `src/conference/settings/hooks/`：AVO 设置草稿等子模块 Hook。
- `src/settings/hooks/`：本机偏好。

组件、模型、纯控制器与平台适配文件保留在原模块目录；不为已移动 Hook 保留旧路径转发文件。
