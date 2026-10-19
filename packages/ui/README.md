# @vocespace/ui

Web 和 React Native 共用的 UI 包。2026-10-11 将原 `@vocespace/meeting-ui` 合并至本包：基础部分和会议组件目前由同一组应用消费、一起维护，无需独立 package。

- `src/theme.ts`：共享主题色。
- `src/types.ts`、`src/primitives.tsx`：控件适配接口和基础容器。
- `src/settings-icons.ts`：Web / Native 共用的 SVG 定义。
- `src/svg-resource.ts`：原 Web `components/Icon` 的完整资源入口、`SvgType`、`SvgResourceProps` 与 `pictureCallback`；复用已有 settings/meeting 图形，不维护重复路径。
- `src/meeting/`：会议布局、成员、聊天、操作栏与视图状态。
- `src/meeting/settings/`：设置子面板的共享布局。

两端从 `@vocespace/ui` 导入；包内使用相对导入，避免经过根入口形成循环。`src/index.ts` 是运行时入口，`src/public.d.ts` 是不引入 React Native 全局类型的公共类型入口；新增导出需要同步两处。执行 `pnpm typecheck:ui` 验证真实组件实现。

`createSvgResource(render)` 将同一份资源绑定到平台渲染器：Web 的 `components/Icon/index.tsx` 保持兼容入口并生成原 DOM；Native 的 `src/ui/SvgResource.tsx` 通过 `react-native-svg` 渲染，容器/文字映射到 View/Text。使用方式一致：`<SvgResource type="google" svgSize={25} />`。Logo 等非正方形资源默认保持 Web 原尺寸，可通过 `width` / `height` 显式调整。颜色、路径、渐变和 viewBox 均维护在本包。Ant Design 的 Email 图标仍使用平台库；Native 提供 `MailOutlined` 命名适配。

仅依赖 React / React Native 和 `@vocespace/meeting-core` 的纯规则。平台按钮/图标/输入框、媒体渲染等通过 props 注入；LiveKit 实例、网络、会话、权限和持久化留在端内。Web 使用 react-native-web 映射。本次合并只调整包与引用，组件 JSX、样式和交互保持原样。
