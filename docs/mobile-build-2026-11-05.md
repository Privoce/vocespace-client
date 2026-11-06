# Mobile 本机构建（2026-11-05）

## 配置修复

根 `vocespace.conf.json` 的 Mobile API 已为 `https://vocespace.com`，RDS 已开启，但原 `apps/mobile/vocespace.public.json` 仍为 localhost 且关闭统计。原构建逻辑优先使用投影，会把过期配置带入包中。

本次重新导出公开投影，并让 `app.config.js` 在存在私有配置时读取当前配置；云构建没有私有配置时读取投影。二者都不存在时失败，不再静默回退 localhost。Expo extra 继续只允许 Mobile API / meetingUiPreview 和 analytics 三个公开字段。云构建前仍须执行 `node scripts/config.mjs public --config vocespace.conf.json`。

已验证：Mobile/UI 类型、依赖边界、配置结构、本机优先级、无私有文件时的投影回退，以及私有字段哨兵不会进入结果。线上 API hello 和 RDS script 返回 HTTP 200。

## iOS

Xcode 26.2 / iOS Simulator SDK 26.2，Release 通用模拟器构建成功（arm64 / x86_64）。保留正常 ad-hoc 签名，`codesign --verify --deep --strict` 通过。构建后从 App 的 `EXConstants.bundle/app.config` 确认线上 API 和 RDS 设置。

产物：`build/mobile-20261105/VoceSpace-ios-simulator-Release.zip`，其中包含 `.app` 和内置 Hermes JS bundle，不依赖 Metro。此包仅支持模拟器，不是 iPhone IPA。本机没有有效 Apple 签名身份，EAS 尚未登录；真机 IPA 需要 Apple 团队及主 App / Broadcast 扩展签名。

本次未进行真机登录、Keychain、会议、屏幕共享或 HLS 验收。

## Android

本机原无 Java / Android SDK，工具安装到 `~/Library/VoceSpaceBuildTools`，不修改全局 shell 配置：Corretto JDK 17.0.21、Android Command-line Tools 16、SDK / Build Tools 36、NDK 27.1.12297006、CMake 3.22.1。JDK 通过官方 SHA-256 校验，命令行工具通过 Google 仓库校验。

Android JS Release 导出和原生 `assembleRelease` 均通过，成功构建日志位于 `build/mobile-20261105/android-build.log`。产物 `build/mobile-20261105/VoceSpace-android-Release-test.apk`，约 64 MB，含 arm64-v8a / armeabi-v7a 和内置 JS bundle。

已验证 APK v2 签名、`assets/app.config` 中线上 API / RDS 开关及公开字段白名单，包中没有 `vocespace.conf.json`。`zipalign -c -P 16 -v 4` 通过，20 个 ARM64 `.so` 的所有 LOAD 段对齐均至少 16 KB；这不代替 16 KB 真机运行验收。

首次官方 Gradle / Maven 下载较慢，Gradle 9.0.0 使用华为镜像下载并与官方 SHA-256 比对通过；本次使用产物目录内的 `mirror.init.gradle` 临时优先解析 Maven 镜像，保留官方回退，不修改源码仓库或全局 Gradle 配置。需要复用本次镜像时，为下方命令追加 `--init-script ../../../build/mobile-20261105/mirror.init.gradle`。

原生构建使用：

```bash
export JAVA_HOME="$HOME/Library/VoceSpaceBuildTools/amazon-corretto-17.jdk/Contents/Home"
export ANDROID_HOME="$HOME/Library/VoceSpaceBuildTools/android-sdk"
export NODE_ENV=production
cd apps/mobile/android
./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

当前原生 release 配置使用 Expo 生成的 debug keystore，仅用于测试 APK，不作为商店签名。包名沿用 `com.vocespace.mobile.dev`。本次不上传任何商店。
