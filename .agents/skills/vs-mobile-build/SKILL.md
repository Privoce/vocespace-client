---
name: vs-mobile-build
description: 为 VoceSpace Mobile 执行 iOS IPA、Android APK/AAB 原生打包与产物校验。支持 -t ios、-t android 或 -a 双端打包；用于构建请求，不自动上传商店或部署服务器。
---

# VoceSpace Mobile Build

将当前 VoceSpace 源码编译为可交付的原生安装包。以项目当前配置和用户指定的产物用途为准，完成构建、校验与产物交付；不能把 JS 导出、模拟器包或旧安装包当作本次真机打包完成。

## 调用与参数

```text
$vs-mobile-build -t ios
$vs-mobile-build -t android
$vs-mobile-build -a
```

- `-t ios`：仅构建 iOS。
- `-t android`：仅构建 Android；兼容用户输入 `andorid`，归一化为 `android`。
- `-a`：两个平台都构建，共享准备只执行一次。
- `-t` 与 `-a` 必须且只能选择一个；重复选项、未知平台、缺少参数和两者同时出现均报错。不得遇到非法参数后自行选一个平台继续。
- `-h` / `--help` 只显示用法，不触发构建。

在任何安装依赖、导出配置、修改构建号或构建操作之前，使用本技能的 [scripts/parse_args.py](scripts/parse_args.py) 校验选项。例如在定位技能目录后调用 `python3 /绝对技能目录/scripts/parse_args.py -t ios`。脚本输出 JSON 中的 `targets`，它只解析参数，不执行打包。

自然语言已经明确“仅 iOS”“仅安卓”或“两端”时，映射为上述参数后校验；没有目标且上下文也没有指定时，询问平台。自然语言中的“TestFlight”“Ad Hoc”“正式 AAB”“EAS”等是构建用途约束，不要作为未知 token 传给参数解析器。显式参数与自然语言冲突时先澄清。

## 定位项目与选择产物

1. 优先使用用户指定的 checkout，其次使用当前工作区的 VoceSpace 仓库。核对 `apps/mobile/package.json` 中名称为 `@vocespace/mobile`，并有 `pnpm-workspace.yaml`。无法定位时询问路径，不对其他项目运行命令。
2. 读取仓库 `AGENTS.md`、适用的 `.agents/rules/`、`mobile_deploy.md`、`apps/mobile/app.json` / `app.config.js` / `eas.json`；以当前文件为准。详细命令维护在仓库根 `mobile_deploy.md`，不在技能安装目录寻找它。缺少指南时先检查 `mobile_build.md` 和 `docs/ios-build-2026-11-09.md`、`docs/mobile-build-2026-11-05.md`，历史成功不代表当前机器仍具备签名。
3. 默认复用本地工具链：iOS 输出 Release Archive 与 App Store Connect IPA，Android 输出内置 JS 的测试 APK。开始时说明目标和默认用途。用户指定直接安装到登记 iPhone 时改为开发 / Ad Hoc IPA；指定 Google Play 时输出正式签名 AAB；用户指定 EAS 时采用云构建。
4. 普通打包请求授权必要的本地准备、prebuild 和构建。商店上传、发给测试人员、服务器部署、修改包名或撤销证书不由打包请求推导授权。已有明确授权继续沿用，不重复询问。缺少签名或账号时明确缺项，不用关闭签名或模拟器产物替代；本地受阻不自动改走付费云构建。

## 共享准备

- 检查 git 状态，保留未提交改动与新增文件。使用根 `.nvmrc` 和 `packageManager` 的版本；依赖需要安装时使用 `pnpm install --frozen-lockfile`，不顺带升级。
- 按项目规范运行 Mobile / UI 类型、边界和相关测试；同一源码状态已有可信结果可复用。区分已有失败与本次失败，不能绕过检查后称可发布。
- 核对 `deployment.mobile.apiUrl`。打包唯一私有配置为仓库根 `vocespace.deploy.conf.json`，有该文件时执行 `node scripts/config.mjs public --config vocespace.deploy.conf.json`；云端只有公开投影时验证它，不编造私有配置；不得回退到开发配置 `vocespace.conf.json`，确保 `app.config.js` 采用同一来源。用 Expo public config 验证最终 API。不要打印完整服务端配置或私钥；旧 `EXPO_PUBLIC_API_URL` 不是当前入口。
- 核对版本与构建号。复用已有团队、Bundle ID / package、App Group 和签名身份；新上传构建号应高于已用编号，本地和 EAS remote 计数分别核对。不要未经检查就将历史 `2` 固定改成 `3`。
- 新增原生模块必须重新 prebuild、编译和安装。保留已有原生手工修改，避免 `prebuild --clean`。不重启现有 Web/API/Metro，也不因 API 待部署而自动部署服务器。
- 每次使用独立 `build/mobile-时间戳/` 目录，按 `ios/`、`android/` 分开保存日志与产物，避免覆盖旧包。长构建用可轮询进程并定期报告实际进展。

## iOS 路径

读取 `mobile_deploy.md` 第二部分。检查 macOS、Xcode SDK、CocoaPods、开发者团队、证书私钥与两个 target 的描述文件。

1. 同步 iOS prebuild，确认 `VoceSpace` / `VoceSpaceBroadcast` 同团队、共享 App Group，主 App 与扩展版本一致。
2. 用 `generic/platform=iOS`、Release 和独立 derivedData / archivePath 构建。沿用项目已验证的最低系统版本要求；发生交叉编译环境污染时只从本次命令移除 `CC/CXX/CPP/LD/AR/CFLAGS/CXXFLAGS/LDFLAGS`。
3. 按用途导出：`app-store-connect` 为 TestFlight，`release-testing` 为 Ad Hoc，`debugging` 为登记设备开发包。使用 `destination: export`，不隐式上传；保存 export plist 和日志。
4. 对最终 IPA 运行仓库 `scripts/check-ios-broadcast.py`，解包验证代码签名、主 App / 扩展版本、Bundle ID、App Group、描述文件及内置 API。广播键 `RPBroadcastProcessMode` 应直接位于 `NSExtension`，避免旧 90362 问题。
5. 输出 IPA、Archive 与 SHA-256。说明 Store IPA 需要通过 TestFlight 分发，开发 / Ad Hoc IPA 限定描述文件内设备。钥匙串交互需要操作者处理，不能把等待授权写成构建成功。

## Android 路径

读取 `mobile_deploy.md` 第三部分。检查 JDK 17、实际 SDK / NDK / CMake 路径；文档中的用户目录仅是该机器示例，不能直接假定其他机器存在。

1. 同步 Android prebuild，核对包名、versionCode 和 release signingConfig。
2. 默认构建 ARM 真机 Release APK：`assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a,armeabi-v7a`，内置 JS，保留 Gradle 日志。
3. 当前生成工程通常使用 debug keystore；交付时明确为测试签名。用户要求正式 AAB 时使用已有正式签名方案或获授权的 EAS production，不能仅改成 `bundleRelease` 后宣称正式签名完成。
4. 保存新 APK，运行实际 Build Tools 下的 `apksigner verify --verbose --print-certs` 和 `zipalign -c -P 16 -v 4`；核对原生 ELF 对齐和 API 配置。ZIP / ELF 静态检查不代表 16 KB 设备运行通过。
5. 输出 APK/AAB、SHA-256、包名和签名用途。安装到设备只在用户要求或当前任务已授权时执行；签名冲突不默认卸载清数据。

## EAS 与双端执行

用户选用 EAS 时读取指南第四部分，确认项目归属和 `extra.eas.projectId`。云构建输入包含完整 monorepo 及公开投影，排除私有配置与本地凭据。使用 preview 生成 APK / Ad Hoc IPA，production 生成 Store IPA / AAB；下载最终包执行对应校验，记录 build ID。构建完成不自动运行 submit。

`-a` 只准备一次公共依赖和配置，再顺序处理两个平台。平台特有阻塞不阻止另一个已授权平台构建；共享源码/配置检查失败则先解决共同阻塞。对同一错误没有新证据或新修复时停止重复重试，报告可操作的缺项。不得把一端成功称为两端完成。

## 交付

为每个目标报告：成功 / 失败 / 阻塞、实际产物绝对路径、版本/构建号、用途与签名、API 地址、日志和 SHA-256、执行的校验以及未做的真机项目。记录源码版本及是否包含未提交修改；按项目规范更新 checklist，区分编译、上传、安装与设备验收。仅在产物真实存在且校验通过后声明构建成功。
