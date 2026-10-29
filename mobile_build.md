# VoceSpace App 构建与测试发布

更新：2026-10-27。当前 App 为 Expo 55 / RN 0.83 / React 19.2，使用 LiveKit/WebRTC、DocumentPicker、SecureStore、Video 和 iOS Broadcast 扩展，必须使用自定义原生 App，不能用 Expo Go。先部署配套 API，见 [Linux 部署](linux_deploy.md)。

本批范围为昵称 / 头像修复与测试版准备；暂停房间权属迁移、一起看 / 教学等新功能。以下提交商店的命令由发布者在完成签名和资料配置后执行，仓库本身不自动上传或发布。

## 1. 开始前

在仓库根目录使用 `.nvmrc` 指定的 Node 24.12.0、pnpm 10.27.0：

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck:mobile
pnpm typecheck:ui
pnpm check:boundaries
pnpm test
```

构建前确保本批全部修改已纳入要发布的源码，包括未跟踪文件；不要从尚未包含修复的旧远程分支构建。iOS 本机构建需要 macOS / Xcode / CocoaPods；Android 本机构建需要 JDK 17 和项目对应 Android SDK / NDK。也可使用下面的 EAS 云构建。

## 2. 先确定 App 身份、图标与 API

编辑 `apps/mobile/app.json`：

| 项目 | 当前值 / 发布要求 |
| --- | --- |
| `name` | VoceSpace |
| `version` | 当前 `1.0.0`，由 `apps/mobile/app.json` 设置对外版本 |
| `ios.bundleIdentifier` | 当前 `com.vocespace.mobile.dev`，首次注册商店前改成你控制且长期使用的正式 ID |
| `android.package` | 当前 `com.vocespace.mobile.dev`，首次上传 Play 前确认正式 package；后续不能把改包名当作原 App 更新 |
| `ios.supportsTablet` | 当前 true；需测试 iPad 并准备相应截图，不能只验收 iPhone |
| `icon` / Android adaptive icon | 当前 app.json 尚未配置正式发布图标；上传前提供品牌 PNG 并配置，不把默认开发图标当发布素材 |
| `scheme` | `vocespace`，不要自行加入包含长期 token 的 URL 流程 |

这里只提供包名占位规则，不代你注册 Apple / Google 标识。改 ID 后应重新生成原生工程；旧 development build 是另一个安装，不会因 Metro 刷新变成新 ID。

生产 App 的构建环境必须有：

在唯一的 `vocespace.conf.json` 设置 `deployment.mobile.apiUrl`，然后从仓库根执行：

```bash
node scripts/config.mjs public --config /实际路径/vocespace.conf.json
```

生成的 `apps/mobile/vocespace.public.json` 是公开构建投影，由 `app.config.js` 选择 mobile / analytics 字段写入 Expo extra。它可随 EAS 上传；完整服务端 JSON 必须留在服务端，不进入安装包。地址改变后重新导出并构建，不再读取 `EXPO_PUBLIC_API_URL` 或 `.env.local`。

## 3. 头像报错的处理

`当前 App 未包含图片选择模块` 表示安装包缺少 `ExpoDocumentPicker`，还没有执行上传。仓库已依赖 `expo-document-picker@55.0.17`，iOS Pods 中已注册该模块。安装 JS 依赖、重新启动 Metro、仅执行 `expo export` 都不能给旧安装包补原生模块。需要重新编译并**安装新包**。参考 [Expo DocumentPicker](https://docs.expo.dev/versions/v55.0.0/sdk/document-picker/)。

当前头像入口使用系统“文件”选择器，支持 JPEG / PNG / WebP / GIF，文件小于 2 MB；它不是相册裁剪器，HEIC 图片需先导出为支持格式。取消选择不上传。旧包仍可打开会议和发送文字反馈，但应升级后再测试头像 / 附件。

```bash
cd apps/mobile
pnpm exec expo prebuild --platform ios
pnpm exec expo run:ios --device
# Android 开发设备：
pnpm exec expo run:android --device
```

原生目录 `ios/`、`android/` 被 Git 忽略，由 app.json、插件和锁文件生成。不要先用 `--clean` 删除可能存在的原生手工改动；如需全新生成，在干净 checkout 里运行。用正在运行的 Metro 时可加 `--no-bundler`，避免重复服务。

本批新增 `expo-localization@55.0.19` 读取系统首选语言，并在 app.json 声明英语 / 简体中文 / 俄语。也需要按上述步骤重新生成并安装原生包；旧包缺少模块时回退英文，已保存的手动语言仍优先。首次使用中文 / 俄语系统语言时显示对应语言，其他语言或读取失败使用英文；“我的 → 会议浏览偏好”与“会议设置 → 常规”复用语言选择器，切换即时生效并保存。在没有手动选择时，返回前台会重新读取系统语言。此处读取的是系统语言设置，不申请定位权限。参见 [Expo Localization](https://docs.expo.dev/versions/v55.0.0/sdk/localization/)。

账号登录还依赖 Keychain：不要用 `CODE_SIGNING_ALLOWED=NO` 生成用于账号验收的安装包，它可能导致 `ERR_KEY_CHAIN`（缺少 entitlement），即使 API 登录成功也无法保存会话。模拟器构建保留 ad-hoc 签名，例如 `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`；真机 / 商店使用对应开发或分发签名。安装后单独验证安全存储写入与读取，不能仅凭安装成功判断。

若 Xcode 调用了 `x86_64-w64-mingw32-gcc` 并报 `-target` 等参数错误，是 shell 的交叉编译环境污染；仅对本次构建移除 `CC/CXX/CPP/LD/AR/CFLAGS/CXXFLAGS/LDFLAGS`，不要修改全局工具链。Node 找不到时检查生成目录中的 `.xcode.env.local` 是否指向当前 Node。

安装后验收：打开更改头像 → 出现系统选择器 → 取消正常返回 → 用测试图片上传 → 重新登录 / 重启后头像仍存在。文件选择器出现只验证原生模块，上传成功还取决于 API 与 Supabase Storage/RLS。

## 4. EAS 构建配置

已提供 `apps/mobile/eas.json`：

| profile | 用途 | 产物 / 依赖 |
| --- | --- | --- |
| development | 真机开发 | dev client，需要 Metro |
| simulator | iOS 模拟器 | 不可提交 App Store，不可安装到 iPhone |
| preview | 小范围独立安装测试 | Android APK；iOS internal/ad hoc，需设备注册与签名；不依赖 Metro |
| production | 商店 / TestFlight | Android AAB、iOS 分发 IPA；自动递增 build number / version code |

EAS 命令从 `apps/mobile` 执行，上传范围包含 monorepo 的共享 packages。不要仅打包此子目录，也不要上传本机 `.env.local`、证书或服务端配置。使用 Git ignore 默认规则，新增 `.easignore` 时需保留原有敏感文件排除。参见 [Expo monorepo 构建说明](https://docs.expo.dev/build-reference/build-with-monorepos/)。

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
# 构建前，回到仓库根按上面的命令重新生成公开配置。
```

已有 EAS 项目时连接原项目，不重复创建；`eas init` 写入的 projectId 应保留。旧 EAS 业务环境变量不再被代码读取，改动公开配置后重新导出。先用 `eas whoami` 核对所属组织。CLI 示例使用官方最新版；在团队 CI 中记录本次验证过的 EAS CLI 版本后固定使用。

### iOS 屏幕共享签名

本仓库 `withScreenSharing.cjs` 会生成：

- 主 App：你选择的 bundle ID。
- Broadcast 扩展：`<bundleIdentifier>.broadcast`，target 为 `VoceSpaceBroadcast`。
- 两者共用 App Group：`group.<bundleIdentifier>`。

插件已补充 `extra.eas.build.experimental.ios.appExtensions`，使 EAS 在生成 Xcode 工程之前识别扩展的签名需求。Apple Developer 里主 App 和扩展需使用同一团队，分别有正确 provisioning profile，并启用对应 App Group。改正式 bundle ID 后这三个标识需一起更新，不能仅修改主 target 的签名。参见 [Expo App Extensions](https://docs.expo.dev/build-reference/app-extensions/)。

### 构建与安装

```bash
# 先做不依赖 Metro 的测试包
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview

# 商店构建；上传前先完成下一节的发布检查
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

保存每次 build ID、源码版本、API 地址和产物。Android APK 可直接给已允许安装的测试设备；AAB 交由 Play 分发。iOS preview 只安装到签名包含的设备；大范围测试用 TestFlight。签名私钥 / Android upload keystore 必须受控备份，后续更新使用同一身份。

## 5. Apple / TestFlight

1. 加入 Apple Developer Program，确定正式 bundle ID、App Group 和扩展签名，创建 App Store Connect 应用记录。
2. 上传 production IPA。可从构建页面下载后使用 Transporter，也可明确指定 build ID：

   ```bash
   npx eas-cli@latest submit --platform ios --profile production --id YOUR_IOS_BUILD_ID
   ```

3. 配置 App Store Connect 访问凭据 / App ID；不要把 API key 或密码提交到仓库。处理完成后在 TestFlight 添加测试人员；外部测试可能需要 Beta App Review。上传并不等于正式上架，正式发布仍需在 App Store Connect 提交审核。参见 [Expo iOS 提交](https://docs.expo.dev/submit/ios/)。
4. Apple 自 2026-04-28 起要求上传的 iOS/iPadOS App 使用 iOS/iPadOS 26 SDK 或更新版本构建；本机 Xcode 26.2 可提供对应 SDK，EAS 则检查构建日志的实际镜像 / SDK。不要把旧系统模拟器运行版本误认为构建 SDK。参见 [Apple SDK 要求](https://developer.apple.com/news/?id=ueeok6yw)。

准备品牌图标、iPhone / iPad 截图、支持网址、隐私政策 URL、审核联系信息和可用审核账号。按真实数据处理填写 App Privacy、权限用途、加密出口声明及年龄评级；不要自动填“没有加密”或默认关闭隐私申报。会议 / 聊天公开内容涉及的审核要求按实际产品核对。参见 [Apple 审核指南](https://developer.apple.com/app-store/review/guidelines/)。

## 6. Google Play

1. 创建 Play Console 应用，确认永久 package 与 Play App Signing / upload key。**第一次 AAB 手动上传**到 Play Console 的测试轨道，再配置 Google service account 以使用 EAS Submit。参见 [Expo Android 提交](https://docs.expo.dev/submit/android/)。
2. 先用 Internal testing，添加测试人员，通过加入测试链接从 Play 安装；这与直接安装 APK 不同。完成商店资料、Data safety、内容分级、目标人群、广告及 App access 说明。
3. 后续可提交指定构建；仓库配置默认 internal + draft，不自动推生产：

   ```bash
   npx eas-cli@latest submit --platform android --profile production --id YOUR_ANDROID_BUILD_ID
   ```

4. 按当前官方要求，2026-08-31 起新 App / 更新需 target Android 16（API 36）或更高。当前依赖默认 API 36，但仍以最终 AAB / 构建配置为准。参见 [Google target API 要求](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)。
5. App 包含 WebRTC 等 native `.so`，应按 [Android 16 KB 页大小验证](https://developer.android.com/guide/practices/page-sizes)检查最终 APK/AAB 的 ELF / ZIP 对齐，并在 16 KB 环境运行。JS 导出和普通模拟器成功不能代替此项。
6. 对 2023-11-13 后创建的个人开发者账号，官方要求至少 12 名测试人员连续参加封闭测试 14 天，之后申请生产访问权限；Internal testing 不替代该条件。具体资格以账号控制台为准。参见 [Google 测试要求](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)。
7. Google Play 的账号删除 URL 填写部署后的 `https://vocespace.com/deleteAccount`。该页面公开说明删除范围，支持邮箱 / 密码登录，再次输入密码并确认后注销；无需安装 App。必须同时部署新 Web / API、配置同源 `ACCOUNT_PUBLIC_URL` 和 Supabase service role，并用专用测试账号完成验证后再填入商店。不要把 API 删除端点或隐私协议页当作删除页面。参见 [Google 账号删除要求](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)。

隐私政策可使用部署后的 `https://space.example.com/legal/privacy`，用户协议为 `/legal/terms`；先确认匿名访问正常且内容符合实际服务。反馈入口不能自动替代商店要求的所有举报 / 屏蔽或内容管理能力。Google 登录按钮和会员标签未代表真实接入能力，商店文案不要宣称这些尚未实现的能力。

## 7. 本地 Release 验证与检查清单

```bash
# 在 apps/mobile 中；本地运行的 Release 并不自动具备商店分发签名
pnpm exec expo run:ios --configuration Release --device
pnpm exec expo run:android --variant release --device
```

不要把默认 Android debug 签名的 release APK 当可提交商店的产物；正式分发优先使用已配置凭据的 EAS production。iOS 使用 Xcode Archive 时同样检查主 App 和扩展的签名及 build number 一致。

- [ ] API 已更新，production 构建使用真实 HTTPS 地址，关闭 Metro 后独立启动正常。
- [ ] 注册 6 位验证码 / 重发、登录、忘记密码、记住我、注销均用测试账号完成。
- [ ] 昵称保存失败保留草稿；成功后前后台、重新登录仍为新昵称。
- [ ] 头像与反馈文件选择不再报模块缺失，取消无副作用；实际上传与回显正常。
- [ ] 协议 checkbox / 页面 / 返回、反馈输入与关闭、键盘和安全区正常。用户已于 2026-10-27 确认此前反馈小屏完整滚动通过；新构建仅做回归。
- [ ] Web / iOS / Android 真实会议、麦克风 / 摄像头 / 屏幕共享、后台、断网与退出；录屏扩展单独验证。
- [ ] 关闭自动预览或验证真实 HLS，不能用占位内容验证自动加入。
- [ ] 正式图标 / 截图、隐私 / 删除 URL、审核账号、权限声明、签名和版本号齐全。
- [ ] Google 16 KB 与 SDK 要求、Apple SDK / App Group / 扩展签名检查通过。

本次准备不会自动注册商店、接受协议、签名上传或提交审核；需要开发者账号及签名资料。构建 / 自动测试、模拟器、真机和商店审核分别记录，不将其中一项成功当作全部完成。

本次本地结果：iOS Debug 原生构建与模拟器更新安装完成，实际文件选择器打开 / 取消通过；双端 JS 导出通过。当前机器缺少 Java Runtime / Android SDK，未完成 Android 原生构建；尚未使用 Apple / Google / EAS 凭据签名或上传商店构建。正式昵称与头像上传仍需配套 API 和测试账号回归。

## Umami 统计（2026-10-29）

首期 Web / App 共用事件字典。Native 直接调用 HTTP 接口。在唯一 JSON 的 `analytics` 中设置 `enabled`、`url`、`websiteId`，再运行上述 public 导出命令并重新构建。development build + Metro 的 `__DEV__` 模式仍不发送统计。

本次配置迁移的结构、秘密隔离和生效方式见 [JSON 配置说明](docs/configuration.md)。JS 导出不代替商店签名或真机验收。
