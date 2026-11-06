# App 图标

由仓库根 `pnpm generate:mobile-icons` 从共享 `svgResource({ type: 'logo' })` 生成，保留原路径和蓝绿渐变。不要手工修改 PNG；修改共享 logo 后重新生成。

- `icon.png`：1024×1024 RGB，无透明通道，背景 `#121212`，供 iOS / Expo 通用图标使用；系统负责圆角裁切。
- `adaptive-foreground.png`：1024×1024 RGBA，透明底，Android 主体直径为 60/108，适应不同桌面蒙版。
- `adaptive-monochrome.png`：同样的透明轮廓，白色前景，供 Android 主题图标着色。

`app.json` 配置背景色与图片路径；Expo prebuild 生成 iOS AppIcon 和 Android 各密度的 launcher / round / adaptive / monochrome 资源。PNG 随源码保存，不依赖构建时转换。打包说明见根目录 [mobile_build.md](../../../../mobile_build.md)。
