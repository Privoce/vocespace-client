# VoceSpace Mobile

独立 React Native / Expo development build 子项目。使用根 `.nvmrc` 和 pnpm workspace。四 Tab 为首页 / 会议 / 消息 / 我的；消息和我的只保留入口与本机设置。

已接入访客 Bearer、安全存储、手动观众加入、LiveKit 接收音视频及退出控制器。此功能默认关闭，仅用于明确配置的无子房间测试 Space。配置及限制见 [Native 观众试运行](../../docs/native-observer-pilot.md)。公开 feed、实时预览、滑动和自动加入尚未实现。

- `pnpm dev:mobile`：启动 Metro，使用已安装的 development build。
- `pnpm --filter @vocespace/mobile ios` / `android`：生成、构建并安装原生开发客户端，需要对应原生工具链；不能使用 Expo Go。
- `pnpm typecheck:mobile`：Native 类型检查。
- `pnpm --filter @vocespace/mobile export`：iOS/Android JS 导出，不等同于原生编译或实际媒体互通。

API 地址通过 `apps/mobile/.env.local` 的 `EXPO_PUBLIC_API_URL` 配置，参考 `.env.example`。生产要求 HTTPS；手机和模拟器必须能直达 API 与 LiveKit。

页面位于 `src/screens`，偏好 Hook 位于 `src/settings`。`src/conference` 的控制器由 App 稳定父层持有，`src/api` 注入安全存储和共享 SDK。Native 不导入根 lib、Web 或服务端代码。凭证使用 SecureStore，非敏感偏好使用 AsyncStorage。

Expo 55 / RN 0.83 / React 19 与 Web React 18 分开解析。LiveKit RN 3.0.0、WebRTC 144.2.0、livekit-client 2.22.3 及 Expo 插件版本固定在 package.json / lockfile。`ios`、`android` 是被 Git 忽略的 Expo CNG 生成目录；通过 app.json / config plugin 维护原生配置。

UI 使用 `@ant-design/react-native`（Ant Design 原生版），沿用 Web 的 `#22CCEE` 主色；按钮、输入、开关和 TabBar 经 `src/ui/controls.tsx` 与 `src/theme.ts` 统一管理。字体随包加载，手势/动画依赖变更后需要重建原生客户端。详见 [App UI 规范](../../docs/mobile-ui.md)。
