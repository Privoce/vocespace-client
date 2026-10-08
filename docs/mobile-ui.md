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
