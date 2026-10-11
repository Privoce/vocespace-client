# Mobile 输入、设备与会议切换（2026-10-11）

> 最新更新：用户随后要求取消 env 白名单；当前发现、私密 Room 与加入规则见 [全量会议发现](native-space-discovery.md)，本文中的配置限制属于上一批历史。

用户已确认 iOS 模拟器的加入、退出、聊天、上麦及普通后台清理可用。本批修复后出现的新行为仍需回归；Web 原 PC/Phone 设置及会议样式保持现状。设置快照读取失败的联调继续按用户要求暂缓。

## 本批交付

- 输入焦点：Ant Design Native 5.4.3 的 Input 在 `keyboardDidHide` 中再次调用 `Keyboard.dismiss()`，会干扰正在获得焦点的输入框。通过 pnpm patch 删除该监听，保留控件、受控输入和其余清理；重新安装也会应用补丁。测试覆盖真实 Ant Input 的获得焦点、键盘隐藏事件和输入更新。
- 更多菜单：Native Button 内部 underlay/container 的 `height: 100%` 导致每项撑满可用区域。plain 按钮内外层统一自动高度、最小触控高度；不更改 Web 控件。
- 音视频设置：读取本机真实麦克风/摄像头列表和音频输出，切换设备、刷新列表、iOS 系统音频路由选择均不依赖设置快照接口。枚举设备不主动开启采集；发布仍要求独立邀请。
- 默认 Room：恢复新建 Space 时的 `Meeting Room` 和 `☕️ Coffee Break`，包括配置允许的 Native 测试 Space。保留平台原有 `createRoom` 策略。不会覆盖或自动补写旧 Space；旧空 Space 可通过 Web 创建公开 Room。
- 横向切换：当前 Space 的主房间和公开子 Room 提供顶部入口及左右滑动。先通过原退出保护释放旧会话，再以新的 joinId 加入目标；取消确认或回拖不换房。媒体订阅及聊天按当前 Room 筛选，退出清除子 Room 成员引用。
- 纵向浏览：会议 Tab 提供受控 Space 信息列表，卡片上下分页、手动加入；会中上下滑动可退出当前会议并查看相邻 Space。当前没有直播播放器或自动加入，信息卡不会伪装成实时预览。

## 配置与启动

API 继续支持单个 `NATIVE_CONFERENCE_SPACE`，新增可选逗号分隔列表，两者合并去重：

```dotenv
NATIVE_CONFERENCE_SPACE=mobile-test
NATIVE_CONFERENCE_SPACES=mobile-test,second-test
```

这些 Space 必须已存在、允许访客、所有子 Room 均为公开。列表仅向可信 Native 会话开放部署显式配置的会议；不是公开发现授权，也不把任意 `allowGuest` Space 加入目录。包含私密 Room 的 Space 继续拒绝 Native 加入；测试范围内 Web 可以管理公开 Room，创建/改为私密的请求会被拒绝。其他 Space 沿用原行为。E2EE 仍不在试运行范围内。

代码更新后重启 API，并清缓存重启 Metro：

```sh
pnpm dev:api
pnpm dev:mobile --clear
```

如果另一台机器尚未安装本批依赖，先 `pnpm install --frozen-lockfile`。不要重复启动已有端口上的服务。目录接口为 `GET /api/v1/native/spaces`；当前 Room 成员目录为 `POST /api/v1/native/rooms`，后者须提交已确认的 joinId。Native HTTP 仍要求 Bearer 和 JSON 请求头。

## 屏幕共享与模拟器边界

Web 主持人邀请屏幕共享 → App 接受 → API 重验成员和邀请人权限 → 单独授予 screen source → 用户操作系统共享选择器。初始观众令牌仍不允许发布，麦克风、摄像头、屏幕分别授权；没有授予数据或屏幕音频发布权限。

- iOS：CNG 插件 `apps/mobile/plugins/withScreenSharing.cjs` 生成 Broadcast Upload Extension、App Group、Info.plist 和 entitlements，源文件保存在 plugins/broadcast；不手动维护被忽略的 ios 目录。Swift 基于 LiveKit RN 推荐的固定版本 Jitsi 示例，许可证与来源随代码保留。
- Android：启用 LiveKit 的屏幕共享前台服务及 mediaProjection 权限；仍需原生构建和系统授权。
- 共享期间进入后台保留屏幕连接，同时停用摄像头/麦克风；普通后台仍退出。后台停止共享或授权失败后继续清理。退出、滑走、切 Tab 都沿用共享状态确认。
- iOS 模拟器没有真实摄像头，安装的 WebRTC 原生实现也不提供模拟器屏幕采集；不能把空设备列表或模拟器共享失败当作真机结果。麦克风和音频路由按当前系统可用设备处理，不断言模拟器一律无麦克风。
- 真机要重新构建 development build，为主 App 和广播扩展配置有效签名与相同 App Group；热更新 JS 不能安装扩展。

本机已重新生成、编译并安装 iOS 模拟器 development build。其他环境可执行：

```sh
pnpm --filter @vocespace/mobile exec expo prebuild --platform ios --no-install
pnpm --filter @vocespace/mobile exec expo run:ios --device
```

本机 shell 存在交叉编译器 CC 环境变量，验证时仅在命令进程中用 `env -u CC -u CXX` 清除，未修改全局设置。

## 验证与后续

- 155 项单元/Hook 测试、根/Native/共享 UI 类型、依赖边界通过。
- 112 项独立 HTTP + 临时 Redis + Socket 集成检查通过，并通过最终生产 Web 代理重复验证：独立屏幕邀请/撤销、公开子 Room 加入/确认/退出、目录与历史范围；不连接用户 Redis。
- 隔离标准 Web/API 构建通过；双平台 JS 导出通过；Android prebuild 与前台服务 manifest 配置生成通过，尚未原生编译。iOS 模拟器 Debug 编译、安装和启动通过，0 错误、2 条构建脚本警告。
- 尚待用户回归：输入框/中文键盘、更多菜单高度、公开 Room 左右切换、多个 Space 上下浏览、发布中取消切换、权限变化和网络失败。
- 尚待真机：麦克风/摄像头/前后镜头/耳机蓝牙；iPhone 共享画面、系统取消共享、后台停止、主持人撤销；Android 原生编译与同类验证。自动测试和 JS 导出不代替这些项目。
- 下一批仍按 4.5：明确主持人预览授权、真实 HLS/Egress POC、预览租约/撤销、单播放器生命周期，之后接入停留 10 秒且有效播放达标的延迟加入。当前受控目录与手动切换只提供导航基础。

参考：[Apple 摄像头示例的设备要求](https://developer.apple.com/documentation/avfoundation/avcam-building-a-camera-app)、[LiveKit React Native 屏幕共享说明](https://github.com/livekit/client-sdk-react-native#screen-sharing)。

## 2026-10-11 Web prejoin 回归修复

用户反馈自填用户名失败，清空后可加入；旧 Space 的两个默认 Room 在 connecting 时出现、完成后消失。

- `nameCheck` 原先用 `名称__Space` 查用户；已有 Space 中查不到该旧格式 ID 时漏掉响应，最终返回 400。现在按在线成员的显示名检查冲突，无冲突始终返回名称；冲突延续 `02` 起的后缀。同一个可信会话可保留自己的名字，客户端提交的 participantId 不能跳过其他用户的重名检查。
- `useSpaceInfo` 原先把包含两个 Room 的创建默认值当作加载占位，后端旧 Space 实际没有 Room 时就表现为「加入后消失」。现改为空目录，加载后只显示持久化的真实 Room，不改 Web PC/Phone 样式。
- 新建 Space 在真实 HTTP 初始化后保留默认 Room，并向已加入会话返回；新增集成断言验证。旧数据的恢复与新建逻辑分开处理，不能据占位 UI 推断服务端删除了 Room。
- 157 项单元/Hook 测试、120 项生产 Web 代理及隔离 API 集成检查、标准 Web/API 构建、类型和依赖边界通过。旧 Space 数据修复待准确名称：只读检查当前配置的 `mobile-test` 未找到记录，尚未修改用户 Redis。
