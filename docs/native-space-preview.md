# Native Space 预览与 15 秒加入

2026-10-11：按用户最新要求，首页承载手动输入 Space 的加入入口；会议 Tab 直接纵向浏览。预览输出 Space 主会场成员的摄像头、屏幕和声音，所有子 Room（公共/私密）均排除。这个决定替代原设计中“仅主持人单轨、逐房开启”的首版策略；部署开关默认关闭，开启后适用于允许访客的业务 Space。Web PC/Phone 设置、会议样式不变。

## 操作与配置

API 的 `.env.local`（或根目录 `.env.local`）增加：

```dotenv
PREVIEW_ENABLED=true
PREVIEW_RENDERER_BASE_URL=https://your-api.example.com/
PREVIEW_MAX_SOURCES=3
# 仅非 AWS S3 时填写，例如 MinIO；API 和 Egress 都必须能访问。
# PREVIEW_S3_ENDPOINT=https://your-object-storage.example.com
```

`PREVIEW_RENDERER_BASE_URL` 是 **Egress 容器能访问到的 API 基础地址**，可以使用已转发 `/api` 的 Web 地址；有路径前缀时保留前缀。它与手机端 `EXPO_PUBLIC_API_URL` 的用途不同。在远程 Egress 内，`127.0.0.1` 指向 Egress 自己，不能用来访问开发电脑。模板路径为 `/api/v1/preview/render`，JS 和详情路径也在 `/api/v1/preview/` 下。浏览器直接访问不带短期凭证的模板返回拒绝属于正常现象。

继续使用 `vocespace.conf.json` 中现有 `livekit`、`s3.accessKey / secretKey / bucket / region`；不把这些密钥放进 Expo env。Egress 必须支持 Web capture，能访问模板和 LiveKit；API 与 Egress 均需读写同一对象存储。桶保持私有，授权 API 对 `vocespace-preview/` 前缀执行 Get/List/Delete，Egress 对该前缀执行 Put。预览结束后延迟清理该专用前缀；建议桶另加该前缀一天过期的兜底生命周期规则。不会清理现有录制文件。

更新后的 Web 需要重新加载，以安装 `preview_main` 的订阅权限：主会场允许，子 Room 拒绝。API 重启使用 `pnpm dev:api`。新代码并未替你打开真实服务的 Egress 任务或修改本地部署密钥。

App 新增 `expo-video@55.0.21`，需要包含该模块的 development build，仅 Reload Metro 不够：

```sh
# Metro 已运行时：
env -u CC -u CXX pnpm --filter @vocespace/mobile exec expo run:ios --no-bundler
# Android 开发客户端：
pnpm --filter @vocespace/mobile exec expo run:android --no-bundler
```

启动后：首页输入 `mobile-test` 可直接正式加入；会议 Tab 滑动到 `mobile-test` / `mobile1` 先看预览。默认静音，「我的」中的预览静音、自动加入开关生效。主会场无人、未配置媒体出口或启动失败时保留加入按钮；不会因加载/错误提示停留 15 秒而自动加入。

## 实现边界

- 卡片停稳 300ms、与分页位置偏差不超过 10% 后请求预览。一个页面只有一个 HLS player，其他卡片不加载媒体；正式会议连接仍由顶层唯一 controller 持有。
- 首帧之后累计 **连续 15 秒实际前进的播放时间** 才自动加入；缓冲停顿超过 1 秒会重新累计。点击加入与自动加入共用 single-flight。正式 RTC 连接前先暂停并卸载 HLS 媒体，再释放短期租约。切 Tab、拖动、非 active AppState、卸载会立即取消，迟到响应不能恢复旧页播放。
- `POST /api/v1/native/preview` 获取源状态或 120 秒租约；`PUT` 续租，`DELETE` 幂等释放。原生凭证和浏览器 Cookie 分开。播放器 URL 是短期播放能力，不是用户会话或 RTC token；同一会话的新租约撤销旧租约。
- 播放网关对每份 playlist/segment 重验 Native 会话、租约、Space 访客策略和源版本，读取对象前后都检查。仅接受同目录白名单媒体文件名；不转发外链、路径穿越或外部加密密钥。源凭证只用于服务端 Egress 模板，App 无法拿到。
- API 按需创建每个 Space 共享的 Egress Web composite。独立模板只订阅主会场名单，服务身份 `preview_main` 为 hidden、仅订阅、不能发布或发数据；不运行完整会议初始化、Socket、聊天、AI，也不写业务成员。预览用户完全不连接正式 RTC。
- 子 Room 成员变化会在原 Space 写入事务中更新预览 epoch，即使快速移入再移回也会使旧 HLS 失效。主会场成员变化同样使旧源版本失效。遇到版本变化播放器提示重试，重新获取主会场源；不会继续自动加入。Native 子 Room 使用新 identity，且发布端单独拒绝预览服务订阅。
- 持久化键：`v1:preview:jobs`（任务）、`v1:preview:cleanup`（对象清理）、`v1:preview:epoch:<space>`（撤销代次）、120 秒 TTL 的 lease/session/request 键。任务创建仍由单 API 写入者串行；现有 Redis 租约 worker 每 15 秒对账，原 heartbeat/录制清理保持 5 分钟频率。无观看请求约 45–60 秒停止源，单源最长 20 分钟；RPC 不确定结果保留任务供恢复，不盲目重建重复出口。
- 默认最多 3 个同时运行的主会场源。大量连续浏览时可提高上限，但需实际测量 Egress CPU、首帧、HLS 延迟与带宽。这批未实现 CDN、分页 feed、原子容量预留、独立预览 RTC 中继或完整 E2EE 支持。

## 验证

自动验证覆盖播放时间、首帧、后台与快滑取消、迟到租约释放、子 Room 排除、epoch 撤销、playlist 路径安全、会话/租约鉴权和“不写入正式成员”。隔离集成测试使用临时 Redis、HTTP Egress/S3 响应模拟；不代表真实 Egress 编码或设备播放已经验收。

本次检查结果：175 项单元/Hook 测试、144 项隔离 HTTP/Redis/Socket 检查（另经生产 Web 同站代理运行通过）；根与 Mobile TypeScript、边界检查、标准隔离 Web/API 生产构建通过。iOS/Android JS 导出通过；新增播放器的 iOS development build 已成功编译并安装到当前 iPhone 16 Pro 模拟器，首页截图检查正常。Web 构建仍存在既有 Hook/组件警告，未关闭检查。Android 原生编译及真实 HLS 播放尚未验收。

待真实服务回归：

1. 主会场同时开摄像头/屏幕/麦克风，App 仅预览时 Web 人数和聊天不增加，看到主会场内容；公共及私密子 Room 均不能被预览听到/看到。
2. 预览 14.9 秒滑走、15 秒点击加入、快速 A→B→A、切 Tab/后台/系统弹窗，不误加入旧 Space、不出现双声；手动加入可在无预览时使用。
3. Web 将成员移入任意子 Room、关闭访客，旧播放 URL 失效；更新预览后不包含子 Room 内容。
4. 暂停 Egress/断网/S3 失败后可手动加入；无人观看后任务停止、对象最终清理；API 重启后不出现重复源。
5. iOS/Android 实测首帧时间、持续滑动内存、HLS 音画及 RTC 交接。预览仅覆盖主会场媒体和姓名占位，不是完整 Web 小组件/AVO 渲染的镜像。
