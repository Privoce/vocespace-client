# Native 手动观众试运行（4.4 首批）

> 后续更新（2026-10-11）：下文记录早期批次。当前已支持配置的多个 Space、公开子 Room 与独立屏幕邀请；旧的「无子房间/禁止屏幕发布」限制及后台规则以 [新交付](mobile-navigation-controls.md) 为准。私密 Room、E2EE、公开发现及真实预览仍未开放。

2026-10-09：用户确认 Web / API 实测通过后，继续实现原生访客会话与手动观看。此批是 4.4 的一部分，尚不是 4.5 的公开发现、直播预览或自动加入。

## 当前行为

- 首页、会议、消息、我的四 Tab 保留。会议页输入 Space 名称，以本机昵称加入已开放的测试会议；消息和我的不增加账号、私信功能。
- 访客由 API 生成可信会话，App 使用 Bearer。凭证通过 Expo SecureStore 保存，按 API 地址隔离；AsyncStorage 只保存非敏感偏好。浏览器 Cookie 不会被兑换为可读的 Native token。
- 单次加入拥有独立 joinId 和服务端 identity。准备阶段不写业务成员；App 建立 RTC 后，由 API 查询 LiveKit 确认身份及 metadata，再原子写入成员；成功后 App 才订阅轨道。
- 初始以观众进入：RTC token 禁止发布音视频、数据及修改自身 metadata。2026-10-10 新增独立的主持人邀请授权后上麦/开摄像头流程，只有 App 用户主动操作后才采集；协议与验证范围见 [会中交付](native-meeting-controls.md)。可接收会议音频、摄像头视频和屏幕共享。
- 控制器位于 Tab 上方，持有唯一正式连接。退出、取消、切 Tab、进入后台均清理连接；清理失败保留重试入口，并阻止再加入。迟到的 prepare / connect / confirm 不会自动开启订阅。
- Native 凭证禁止访问旧 HTTP 业务接口以提升权限，Socket 管理动作仍被拒绝；观众不能成为主持人。App 已接入确认入房后的文字聊天，详情与本地真实 RTC 验证见 [会议聊天交付](native-conference-chat.md)。

## 为什么只开放专用测试 Space

现有子房间共享一个 LiveKit room。Native 尚未实现子房间订阅权限和 E2EE，因此本批默认关闭，只有 `NATIVE_CONFERENCE_SPACE` 指定的一个测试 Space 可以使用。

该 Space 必须已存在、允许普通访客，且没有任何子房间（包括默认的 Meeting Room、Coffee Break）。先在 Web 整理测试 Space，再开启环境变量。开启后 Web 的子房间新增、修改、删除请求也会被拒绝，初始化不会自动创建私人房间；其他 Space 继续原有行为。

试运行使用无 E2EE 的测试会议，主持人通过 Web 发布内容。不要将现有包含子房间的会议直接设为测试房间。关闭或改换测试 Space 前，先让当前 Native 观众退出；环境变量不是即时踢人开关。

这不是公开授权方案：`allowGuest` 不代表同意出现在公开 feed。4.5 仍需主持人显式授权、轨道白名单与预览媒体链路。

## 本地试运行

在仓库根使用 `.nvmrc` 对应的 Node 24.12.0，执行 `pnpm install --frozen-lockfile`。

1. API 配置 `services/api/.env.local`，加入 `NATIVE_CONFERENCE_SPACE=mobile-test`（换成自己的专用测试 Space）。API 的 Redis / LiveKit 沿用独立后端配置；手机必须能直连配置中的 LiveKit 地址。
2. 在 `apps/mobile/.env.local` 设置 `EXPO_PUBLIC_API_URL=https://你的API地址`。它是公开地址，不是密钥。开发构建可使用局域网 HTTP；真机上的 localhost 指手机本身。API 若供局域网访问，设置 `API_HOST=0.0.0.0`，生产通过 HTTPS/WSS 网关部署。
3. 分别启动 Web / API：`pnpm dev:web`、`pnpm dev:api`。已运行的服务自行按需要重启，本次开发没有替用户调整实际配置或重启服务。
4. 首次安装开发客户端：`pnpm --filter @vocespace/mobile ios` 或 `pnpm --filter @vocespace/mobile android`。后续运行 `pnpm dev:mobile`。修改原生插件/依赖后须重建，不能使用 Expo Go。
5. Web 主持人进入同一个测试 Space 并发布音视频，App 输入名称加入；验证视频、声音、退出、切 Tab、前后台及断网后重试。

若本机曾设置 Windows 交叉编译环境（例如 `CC=x86_64-w64-mingw32-gcc`），iOS 构建前在当前命令环境清除 `CC` / `CXX` / `AR` / `LD`，让 Xcode 使用默认 Apple 工具链；无需改动全局 shell 配置。

`apps/mobile/ios`、`android` 是 Expo prebuild 生成目录，已忽略；原生配置以 app.json、package.json 和 pnpm-lock.yaml 为准。不要把手工原生修改只留在这些生成目录中。

## 协议与存储

| 接口 | 行为 |
| --- | --- |
| POST `/api/v1/session/native`，空 JSON | 无 Bearer 时创建访客；有 Bearer 时验证并恢复同一会话 |
| DELETE `/api/v1/session/native` | 撤销会话凭证及 Socket；调用方必须先完成会议退出，当前 UI 没有独立注销入口 |
| POST `/api/v1/native/conferences` | `{joinId, spaceName, nickname}`，准备观众 RTC 令牌 |
| PUT `/api/v1/native/conferences` | `{joinId}`，查询 RTC 并确认业务成员，重复确认幂等 |
| DELETE `/api/v1/native/conferences` | `{joinId}`，取消/退出；先留取消墓碑，再清理媒体及业务成员 |
| POST `/api/v1/native/chat/history` | `{joinId}`，只向已确认的会议成员返回最近 50 条消息 |

Native 接口只接受 JSON 和显式 Bearer，不接受带 Origin / Sec-Fetch-Site 的浏览器请求。昵称只是展示字段。凭证只在安全存储/内存中持有，不写 URL 或日志。

继续使用 `v1:session:<token>`、`space:<name>`，新增 `v1:native-join:<principalId>:<joinId>`。准备记录和取消墓碑保留 10 分钟；准备授权窗口及初始 RTC token 最长 60 秒；已确认记录跟随会话有效期。成员写入采用比较原始 JSON 的原子更新，保留旧数组结构，避免 Redis cjson 把 `[]` 变为 `{}`。

当前客户端以 `autoSubscribe:false` 连接后等待确认；RTC token 本身具有订阅权限，因此这不是隔离预览用的 token。取消会主动移除当时存在的 RTC 参与者，但 token 有效期内重放、进程被杀后的补偿、乱序媒体事件、会话过期中的完整恢复仍须后续服务端对账完善。不能将此试运行接口用作公开直播发现授权。

## 验证与下一步

本地验证（2026-10-09）：

- 70 项单元/Hook 测试通过，含 Native 凭证恢复/撤销、加入/取消、迟到结果及清理重试测试。
- 51 项生产 Web 代理 + 最小 API 制品集成检查通过；覆盖 Native Bearer、旧接口发布旁路拒绝、子房间限制、并发确认、坏数据拒绝、退出与 Web 数据保留。
- 全项目及 Native 类型、依赖边界、标准 Web/API 构建、重复 Web 制品打包通过；iOS/Android JS 导出通过。
- Expo prebuild 双平台生成通过；CocoaPods 99 个依赖安装成功；Xcode 26.2 的 iOS arm64 Simulator Debug development build 编译通过。安装到 iPhone 17 / iOS 26.2，实际加载首页、会议未配置空态、消息及我的页面，无原生模块加载错误。
- 本次模拟器启动使用空 API 配置和独立 Metro，不连接实际会议。Android 原生编译、SecureStore 真机行为、真实 LiveKit 音视频及 Web 互通尚未验证。

本机 `expo start --localhost` 曾监听 `::1`、却生成 `127.0.0.1` 的 bundle URL。仅在本次测试进程使用 `NODE_OPTIONS=--dns-result-order=ipv4first` 后，模拟器加载成功。若遇到相同开发连接错误可采用此命令环境，不需要改生产地址。

构建期间，临时副本的整体 node_modules 软链接被 Next standalone 清理追踪到工作区，导致 Web 源文件和依赖被误清理。已从构建前副本恢复，425 个 Web 源文件逐一哈希核对一致，依赖按原锁文件恢复；补齐 Next 缓存标记并触发页面重新发现后，原有 Web 首页恢复 HTTP 200，无服务重启。随后在独立安装依赖的副本中完成标准构建和上述制品集成验证；规范禁止再使用这种整体依赖目录软链接，并在打包前验证生成目录不得逃出制品目录。

详细进度见 checklist.md。本地 HTTP 集成使用临时 Redis、随机端口和模拟 LiveKit 管理响应，不连接用户的实际媒体服务。JS 导出、原生编译、模拟器启动与真机音视频分别记录，互不替代。

4.4 的会议文字聊天与 iOS 本地视频 POC 已在后续批次完成；仍待显式上麦与设备权限、外部身份适配、完整网络/音频路由及双端真机互通。4.5 再实现公开源授权、实时预览、上下滑动、容量预留和延迟加入。Umami、账号体系、私信继续后置。

后续验证补充：原先使用 `CODE_SIGNING_ALLOWED=NO` 的模拟器构建能显示页面，但 SecureStore 报缺少 entitlement。会议实连需使用正常签名的 development build；本机已用 Xcode 模拟器 ad-hoc 签名构建验证凭证保存、恢复与入房，未改为明文存储。后续结果以 [聊天交付记录](native-conference-chat.md) 为准。
