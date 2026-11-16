# Mobile 打包与测试分发步骤

更新：2026-11-15。适用于当前 `apps/mobile`（Expo 55 / React Native 0.83），从仓库完整源码生成可安装的 iOS / Android 包。LiveKit/WebRTC、WebView、SecureStore 和广播扩展需要原生编译，不能用 Expo Go 或 JS 导出代替。

当前已经有本地 Android Release APK、iOS 真机 Archive 和分发 IPA 的成功记录，见 [Android 构建记录](docs/mobile-build-2026-11-05.md) 与 [iOS 构建记录](docs/ios-build-2026-11-09.md)。这些旧包不包含后续全部改动；新一轮测试应重新打包。最新工具、文件和个人应用接口的部署状态需单独确认，见 [checklist](checklist.md)。

已安装 Codex 技能时，可直接调用 `$vs-mobile-build -t ios`、`$vs-mobile-build -t android` 或 `$vs-mobile-build -a`；`-t` 与 `-a` 互斥。技能源码见 [vs-mobile-build/SKILL.md](.agents/skills/vs-mobile-build/SKILL.md)，默认执行本地打包与校验，不自动上传商店。

## 一、先选择要生成的包

| 目标 | 产物与安装方式 | 本文路径 |
| --- | --- | --- |
| 自己连接手机调试 | development build，通常依赖 Metro | 第二部分步骤 3；第三部分步骤 4 |
| Android 直接发给测试人员 | 内置 JS 的 APK，手机下载安装 | 第三部分，或第四部分的 preview |
| 少量指定 iPhone 测试 | 开发 / Ad Hoc IPA，仅描述文件包含的设备可安装 | 第二部分，或第四部分的 preview |
| iOS TestFlight 测试 | App Store Connect IPA，上传后通过 TestFlight 安装 | 第二部分步骤 5–7，或第四部分的 production |
| Google Play 内部测试 | 正式签名 AAB，上传后由 Play 安装 | 第四部分 production 与第五部分 |

需要多人测试时，可先交付 **Android APK + iOS TestFlight**。App Store Connect IPA 不能直接发给任意 iPhone 侧载；AAB 也不能像 APK 一样点击安装。

## 二、公共准备与 iOS 本地打包

### 步骤 1：安装依赖并检查源码

以下命令使用 macOS 的 bash / zsh。先进入仓库根目录；其他电脑替换第一行路径。后续本地步骤在同一个终端执行，复用 `MOBILE_REPO` 和各产物目录变量。

```bash
cd /Users/shengyifei/projects/livekit/vocespace/vocespace
export MOBILE_REPO="$PWD"
nvm install
nvm use
corepack enable
pnpm install --frozen-lockfile
git status --short
pnpm typecheck:mobile
pnpm typecheck:ui
pnpm check:boundaries
pnpm test
```

Node 版本由根 `.nvmrc` 指定（当前 24.12.0），pnpm 由 `packageManager` 指定（当前 10.27.0）。没有 nvm 的机器先安装对应 Node 和 pnpm。检查失败先修复；不要在失败后继续分发。确认待发布修改和新增文件都已包含在源码中；保留当前工作区其他修改，不用 reset/clean 清理。

### 步骤 2：设置服务器地址与 App 身份

1. 按 [Linux 部署说明](linux_deploy.md) 部署与本次 App 配套的 API。手机必须能通过公网 HTTPS 访问 API，同时能访问 LiveKit；测试预览还需要真实 HLS 服务。
2. 在根 `vocespace.deploy.conf.json` 中设置 `deployment.mobile.apiUrl`，当前正式服务地址为 `https://vocespace.com`。没有配置文件时参考 `vocespace.conf.example.json` 和 [配置说明](docs/configuration.md)，不要覆盖已有配置。
3. 从仓库根重新导出公开配置，并检查 Expo 实际读取的公开配置：

```bash
cd "$MOBILE_REPO"
node scripts/config.mjs public --config vocespace.deploy.conf.json
pnpm --filter @vocespace/mobile exec expo config --type public
```

确认输出 `extra.vocespace.mobile.apiUrl` 正确。生成文件为 `apps/mobile/vocespace.public.json`。本地有私有配置时优先读取私有配置的公开字段；云构建没有私有配置时读取生成文件。两者都没有会失败。`EXPO_PUBLIC_API_URL` 和 `.env.local` 已不是业务配置入口；更改地址后需要重新生成并打包。完整私有 JSON、证书私钥不能放进 App 或云构建上传内容。

核对 `apps/mobile/app.json`：

| 配置 | 当前值 / 操作 |
| --- | --- |
| `expo.version` | `1.0.0`，用户看到的版本 |
| `expo.ios.bundleIdentifier` | `com.privoce.vocespace` |
| `expo.ios.appleTeamId` | `355Y8J4TGX`，Privoce, Inc. |
| Broadcast Bundle ID | `com.privoce.vocespace.broadcast`，插件生成 |
| App Group | `group.com.privoce.vocechatclient`，插件参数显式指定 |
| `expo.ios.buildNumber` | 当前源码为 `2`；每次上传前改为 App Store Connect 尚未使用的更大值 |
| `expo.android.package` | `com.vocespace.mobile.dev`；首次提交 Play 前确定永久包名 |
| `expo.android.versionCode` | 当前未显式配置；本地 Android 构建需按已有发布记录设置递增整数 |

例如商店最新 iOS 构建确实是 2，下一次可设为字符串 `"3"`；先检查商店记录，不能仅依赖本地值。iOS 主 App 和扩展版本必须一致，改完后重新 prebuild。EAS 使用远程构建号，另见第四部分。

### 步骤 3：准备 Xcode、签名并生成 iOS 工程

本地 iOS 构建需要 macOS、完整 Xcode、CocoaPods 和 Apple Developer 团队权限。在 Xcode → Settings → Accounts 登录团队账号，确认本机有对应证书及私钥。仓库记录中该团队已生成过 Apple Distribution 证书；另一台机器需要导入受控备份或配置自己的可用签名，不能仅凭源码推断本机有私钥。

```bash
cd "$MOBILE_REPO"
xcodebuild -version
xcodebuild -showsdks
pod --version
pnpm --filter @vocespace/mobile exec expo prebuild --platform ios
open apps/mobile/ios/VoceSpace.xcworkspace
```

在 Xcode 中检查 `VoceSpace` 与 `VoceSpaceBroadcast` 两个 target 的 Signing & Capabilities：同一团队、正确 Bundle ID、正确 App Group；自动签名需有权限生成或更新两个描述文件。钥匙串弹窗由本机操作者确认。使用满足 Apple 当前上传要求的 Xcode / SDK，见 [Apple 提交要求](https://developer.apple.com/news/upcoming-requirements/)。

`ios/` 和 `android/` 是被 Git 忽略的生成目录，以 app.json / 插件为配置来源。不要在有手工改动的目录直接使用 `prebuild --clean`；需要全新生成时使用独立 checkout。

如果只想 USB 连接 iPhone 调试，手机信任电脑并按系统要求开启开发者模式后执行：

```bash
cd "$MOBILE_REPO/apps/mobile"
pnpm exec expo run:ios --device
```

这是开发安装路径；生成供分发的独立 IPA 继续步骤 4。已有 Metro 时可加 `--no-bundler`，不要重复启动。

### 步骤 4：归档真机 Release

每次建立新产物目录，避免覆盖旧归档。命令显式使用真机目标，并沿用本项目已成功的最低 iOS 15.1 参数。

```bash
cd "$MOBILE_REPO"
export MOBILE_IOS_OUT="$MOBILE_REPO/build/ios-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$MOBILE_IOS_OUT"
set -o pipefail
env -u CC -u CXX -u CPP -u LD -u AR -u CFLAGS -u CXXFLAGS -u LDFLAGS \
  xcodebuild -workspace apps/mobile/ios/VoceSpace.xcworkspace \
  -scheme VoceSpace -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$MOBILE_IOS_OUT/VoceSpace.xcarchive" \
  -derivedDataPath "$MOBILE_IOS_OUT/derivedData" \
  DEVELOPMENT_TEAM=355Y8J4TGX CODE_SIGN_STYLE=Automatic \
  IPHONEOS_DEPLOYMENT_TARGET=15.1 -allowProvisioningUpdates archive \
  2>&1 | tee "$MOBILE_IOS_OUT/archive.log"
```

看到 `ARCHIVE SUCCEEDED` 再继续。不要用 `CODE_SIGNING_ALLOWED=NO` 绕过签名，否则 Keychain / SecureStore 验收可能失败。`.xcarchive` 是归档目录，尚不是可分发 IPA。

### 步骤 5：选择用途并导出 IPA

下面生成 App Store Connect / TestFlight 导出配置。只执行一种用途；若要 Ad Hoc 包，将 Python 中的 `app-store-connect` 改为 `release-testing`；开发设备包则改为 `debugging`。这些名称来自本机 `xcodebuild -help`。

```bash
python3 - <<'PY'
import os
import pathlib
import plistlib
output = pathlib.Path(os.environ['MOBILE_IOS_OUT'])
options = {
    'method': 'app-store-connect',
    'destination': 'export',
    'teamID': '355Y8J4TGX',
    'signingStyle': 'automatic',
    'manageAppVersionAndBuildNumber': False,
}
with (output / 'ExportOptions.plist').open('wb') as stream:
    plistlib.dump(options, stream)
PY
xcodebuild -exportArchive \
  -archivePath "$MOBILE_IOS_OUT/VoceSpace.xcarchive" \
  -exportPath "$MOBILE_IOS_OUT/export" \
  -exportOptionsPlist "$MOBILE_IOS_OUT/ExportOptions.plist" \
  -allowProvisioningUpdates \
  2>&1 | tee "$MOBILE_IOS_OUT/export.log"
```

看到 `EXPORT SUCCEEDED`，产物通常为 `$MOBILE_IOS_OUT/export/VoceSpace.ipa`。Ad Hoc / 开发包要求主 App 和扩展描述文件都包含测试设备；新增设备需更新描述文件并重新导出。TestFlight 包需要 Apple Distribution 签名及 Store 描述文件，不能用开发描述文件代替。

### 步骤 6：校验最终 IPA

```bash
cd "$MOBILE_REPO"
python3 scripts/check-ios-broadcast.py "$MOBILE_IOS_OUT/export/VoceSpace.ipa"
unzip -q "$MOBILE_IOS_OUT/export/VoceSpace.ipa" -d "$MOBILE_IOS_OUT/inspect"
codesign --verify --deep --strict "$MOBILE_IOS_OUT/inspect/Payload/VoceSpace.app"
shasum -a 256 "$MOBILE_IOS_OUT/export/VoceSpace.ipa" > "$MOBILE_IOS_OUT/SHA256SUMS"
```

广播检查必须通过：曾出现 Apple 90362 错误，原因是 `RPBroadcastProcessMode` 层级错误；当前插件已修复。还需检查主 App 和扩展的描述文件、Bundle ID / App Group、版本一致及内置 API 地址。脚本与代码签名校验不能替代 Apple 上传校验或真机屏幕共享测试。

### 步骤 7：安装或分发 iOS 包

- **开发 / Ad Hoc IPA**：连接已登记设备，在 Xcode → Window → Devices and Simulators 中选择设备，通过 Installed Apps 的添加入口安装 IPA；也可使用 Apple Configurator。安装范围受描述文件限制。
- **TestFlight IPA**：在 App Store Connect 创建或选择 `com.privoce.vocespace` 对应应用；用 Transporter 添加并上传本次 IPA。处理完成后进入 TestFlight，补齐测试信息、出口合规回答及必要审核资料，再添加测试组。测试人员使用 TestFlight 邀请安装。

TestFlight 外部测试首个构建需经过 Beta App Review；上传完成不等于已开放测试或正式上架。参见 [Apple TestFlight](https://developer.apple.com/testflight/)。

## 三、Android 本地测试 APK

先完成第二部分步骤 1–2；Android 本地打包不需要 Xcode 或 Apple 账号。

### 步骤 1：准备 Java 与 Android SDK

需要 JDK 17、Android SDK / Build Tools 36、项目所需 NDK / CMake。可通过 Android Studio SDK Manager 安装。当前工作机已有独立工具目录，以下路径适用于这台 Mac；其他电脑替换为实际路径。

```bash
export JAVA_HOME="$HOME/Library/VoceSpaceBuildTools/amazon-corretto-17.jdk/Contents/Home"
export ANDROID_HOME="$HOME/Library/VoceSpaceBuildTools/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
java -version
adb version
```

历史成功构建使用 NDK 27.1.12297006、CMake 3.22.1；最终以当前生成工程及 Gradle 日志要求为准。首次安装 SDK 时通过 SDK Manager 接受必要许可。

### 步骤 2：同步原生工程并构建

```bash
cd "$MOBILE_REPO"
pnpm --filter @vocespace/mobile exec expo prebuild --platform android
export MOBILE_ANDROID_OUT="$MOBILE_REPO/build/android-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$MOBILE_ANDROID_OUT"
cd "$MOBILE_REPO/apps/mobile/android"
export NODE_ENV=production
set -o pipefail
./gradlew assembleRelease --no-daemon \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a \
  2>&1 | tee "$MOBILE_ANDROID_OUT/build.log"
```

看到 `BUILD SUCCESSFUL` 再继续。这个命令针对 ARM 真机，不含 x86 模拟器。产物为 `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`，已内置 JS，不依赖 Metro。

**当前生成工程的 release 使用 debug keystore，只适合受控测试。** 发布者需核对 `apps/mobile/android/app/build.gradle` 的签名设置；不要把此 APK 当作正式商店签名包。正式 AAB 使用第四部分的 EAS production，或先单独完成可维护的本地正式签名配置。

### 步骤 3：保存并校验 APK

```bash
cp "$MOBILE_REPO/apps/mobile/android/app/build/outputs/apk/release/app-release.apk" \
  "$MOBILE_ANDROID_OUT/VoceSpace-test.apk"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose --print-certs \
  "$MOBILE_ANDROID_OUT/VoceSpace-test.apk"
"$ANDROID_HOME/build-tools/36.0.0/zipalign" -c -P 16 -v 4 \
  "$MOBILE_ANDROID_OUT/VoceSpace-test.apk"
shasum -a 256 "$MOBILE_ANDROID_OUT/VoceSpace-test.apk" > "$MOBILE_ANDROID_OUT/SHA256SUMS"
```

若实际安装了其他 Build Tools 补丁版本，替换 `36.0.0`。确认包名、版本、API 地址和签名身份符合本轮测试。ZIP 对齐通过只覆盖一部分要求；WebRTC 等原生 `.so` 还需要 ELF 对齐检查及 16 KB 环境运行验证，参见 [Android 页大小指南](https://developer.android.com/guide/practices/page-sizes)。

### 步骤 4：安装与分发

手机开启 USB 调试并确认授权；只有一台设备连接时：

```bash
adb devices
adb install -r "$MOBILE_ANDROID_OUT/VoceSpace-test.apk"
```

多设备使用 `adb -s 设备序列号 install -r ...`。也可以把 APK 发给测试人员，在手机上允许对应下载应用安装未知来源应用后安装。签名不同会导致覆盖安装失败；优先使用原签名重建，卸载会丢失本地数据，不应直接当作默认解决办法。

只需要日常开发调试时，可改用下面命令；该路径通常使用 Metro，不作为独立测试包：

```bash
cd "$MOBILE_REPO/apps/mobile"
pnpm exec expo run:android --device
```

## 四、可选：EAS 云构建

没有完整本地原生工具链时可走此流程；两条构建路径任选其一。项目已提供 `apps/mobile/eas.json`，但配置文件存在不表示已登录或已绑定 EAS 项目。云构建不需要把本机 Xcode / Android SDK 上传。

### 步骤 1：登录并绑定项目

先完成公共准备与公开配置导出，然后在 Mobile 目录执行：

```bash
cd "$MOBILE_REPO/apps/mobile"
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
```

选择正确组织，已有项目连接原项目，不重复创建。保留 `extra.eas.projectId`；项目使用动态 `app.config.js`，如果 CLI 无法自动写入，按提示将 projectId 放入 `app.json` 的 `expo.extra.eas.projectId`，再用 `expo config --type public` 确认生效。团队 CI 应记录并固定本次实际验证过的 EAS CLI 版本。

EAS 命令从 `apps/mobile` 执行，上传内容仍须包含根 workspace、lockfile 和共享 packages。当前原生目录被 Git 忽略，云端会重新 prebuild；不要单独复制 Mobile 子目录上传。确认公开投影被包含、完整服务端 JSON 和签名私钥被排除；添加 `.easignore` 时需保留原有敏感文件排除规则。参见 [Expo monorepo 构建](https://docs.expo.dev/build-reference/build-with-monorepos/)。

### 步骤 2：选择 profile 并同步构建号

| profile | 用途 | 结果 |
| --- | --- | --- |
| `development` | 真机开发客户端 | 依赖 Metro |
| `simulator` | iOS 模拟器开发客户端 | 不能安装到 iPhone |
| `preview` | 独立内测 | Android APK / iOS Ad Hoc IPA |
| `production` | TestFlight / Play | iOS Store IPA / Android AAB，自动递增构建号 |

`eas.json` 使用 `appVersionSource: remote`。首次从本地构建切换到 EAS 时，先用下面命令将远程构建号设为商店已经使用的最新值，production 构建再自动递增，避免重复上传编号。不要在每次构建前重置远程计数。

```bash
npx eas-cli@latest build:version:set --platform ios
npx eas-cli@latest build:version:set --platform android
```

以后切回本地打包，也需核对 EAS / 商店最新编号并更新本地配置。参见 [Expo 构建号管理](https://docs.expo.dev/build-reference/app-versions/)。

### 步骤 3：生成 Android APK 或 iOS Ad Hoc IPA

```bash
npx eas-cli@latest build --platform android --profile preview
# iOS：先登记测试设备，再生成包含这些设备的描述文件和包。
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

按提示配置 Android keystore / Apple 签名。已有 Android 发布身份应导入或复用原 keystore，不能随意换 key。iOS 插件会声明 `VoceSpaceBroadcast` 扩展，主 App 与扩展均需要正确 App Group 和签名。完成后从构建页面下载或分享安装链接；iOS 仅允许描述文件列出的设备安装。参见 [Expo 内部分发](https://docs.expo.dev/build/internal-distribution/)。

### 步骤 4：生成商店测试包

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```

保存两个 build ID、日志和下载产物。下载 iOS IPA 后运行第二部分步骤 6 的广播检查，特别确认主 App / 扩展构建号一致。Android 核对正式签名、包名、versionCode、target SDK 和原生库兼容性。EAS 产物与本地产物一样需要安装验收。

## 五、商店测试轨道提交

### iOS：TestFlight

本地 IPA 用第二部分步骤 7 的 Transporter 上传；EAS production 构建可指定本次 build ID 提交：

```bash
cd "$MOBILE_REPO/apps/mobile"
npx eas-cli@latest submit --platform ios --profile production --id YOUR_IOS_BUILD_ID
```

将占位符替换为实际 ID，按提示配置 App Store Connect 应用和访问凭据。上传后的测试信息、合规回答、测试组和外部测试审核仍在 App Store Connect 完成。不要把 submit 成功当成已正式上架。

### Android：Google Play Internal testing

1. 在 Play Console 创建或选择对应包名的应用，确认永久 package、Play App Signing 和 upload key。当前 `.dev` 后缀并不自动阻止测试，但首次发布前应确定是否保留；改包名会成为另一个应用。
2. 首次将 production AAB **手动上传**到 Internal testing，完成控制台要求的资料，添加测试人员并发布内部测试版本。测试人员通过加入测试链接从 Play 安装。
3. 后续如使用 EAS Submit，配置具有相应权限的 Google service account，再提交指定构建：

```bash
cd "$MOBILE_REPO/apps/mobile"
npx eas-cli@latest submit --platform android --profile production --id YOUR_ANDROID_BUILD_ID
```

仓库 submit 配置为 `track: internal`、`releaseStatus: draft`，提交后仍需在 Play Console 检查并发布测试版本。参见 [Expo Android 提交](https://docs.expo.dev/submit/android/)。

商店所需隐私政策、账号删除入口、审核账号、权限与数据声明，应与实际部署一致；SDK / target API 要求以提交当天控制台和官方要求为准。内部测试通过与正式生产发布资格是不同事项。

## 六、交付前的真机检查

- [ ] 记录源码提交及未提交差异、版本/构建号、API 地址、签名身份、构建日志和 SHA-256；分发的是本次新包。
- [ ] 关闭 Metro 后 preview / Release 包仍能冷启动，API 为正确 HTTPS 地址。
- [ ] 登录、重启后的会话恢复、退出、语言与昵称保存正常。
- [ ] iOS / Android 与 Web 实际入会，验证麦克风、摄像头、邀请授权、切房和退出。
- [ ] iOS Broadcast / Android 屏幕共享、切后台、断网重连与停止共享正常。
- [ ] 真实 HLS 预览与自动加入行为正常；工具、WebView、文件上传和个人应用 API 已部署并互通。
- [ ] 新增原生模块已进入包，文件选择取消正常；键盘、安全区、系统返回及 iPad（当前支持）完成回归。

如果出现 `NATIVE_ENDPOINT_REQUIRED`，先核对服务端版本；缺少 DocumentPicker / WebView 原生模块则重新 prebuild、编译并安装；`ERR_KEY_CHAIN` 检查签名与 entitlement。iOS 扩展 90362、模拟器 scheme 冲突等更多排错见 [mobile_build.md](mobile_build.md)。

本文更新只整理步骤，没有执行新的签名构建、上传、生产部署或真机验收；每轮结果应分别记录到 [checklist](checklist.md)。
