# Native 全量会议发现（2026-10-11）

用户要求取消 env 测试白名单，先让 Web 创建的 `mobile-test`、`mobile1` 等 Space 正常被 App 发现和加入，再推进会中直接上下切换及实时预览。

## 当前行为

- `NATIVE_CONFERENCE_SPACE`、`NATIVE_CONFERENCE_SPACES` 已不参与列表、加入、确认、聊天、设备或设置鉴权，可以从部署配置中删除；保留旧变量也不再限制房间。
- 列表读取当前 VoceSpace 的持久化 Space 目录，仅返回允许普通访客的 Space 名称、成员数、公共 Room 数。无需逐个登记环境变量，没有原来的 100 条静默截断。未允许访客或仅邀请加入的 Space 不进入列表，手动输入也不能绕过权限。
- 使用业务目录而不是仅使用 LiveKit 当前活跃 RTC 列表：Web 创建但尚无人连接、或持久化但暂时无人在线的 Space 仍能被发现。只有 LiveKit 内部 Room、没有 VoceSpace 业务记录的对象不自动变成可加入 Space，以免缺失访客策略和成员管理。
- 存在个人私密 Room 不再排除整个 Space。Native 只能加入主房间和公共 Room；目录不返回私密 Room 名称及成员，直接提交私密 Room 名称会被拒绝，确认时再次检查权限。聊天、媒体授权与设置读取共用已确认的当前公共 Room 成员校验。
- Web 保持原有个人私密 Room 自动创建和管理行为。Web 发布端补充向 Native 身份禁止订阅私密 Room 全部轨道的规则；原 Web 对 Web 的订阅规则和 PC/Phone 外观不变。App 仍仅订阅当前公共 Room 成员的轨道。
- 打开会议列表立即刷新；浏览时每 15 秒刷新，返回前台再次刷新。关闭/卸载清理计时器、监听和请求；刷新不重叠，失败保留错误提示与重试。列表不创建会议成员或启动媒体。

## 使用与回归

更新并重启 API（`pnpm dev:api` 会先重新构建），刷新 Web 会议页面以加载新的发布端权限规则，重新加载 App JS。此次没有新增原生依赖，无需再次安装 iOS development build。

用 Web 创建两个允许访客的 Space，打开 App 会议列表，确认两者均出现并分别手动加入。检查加入后聊天、上麦邀请和退出；Web 新建第三个 Space 后重开列表或等待刷新应出现。再检查关闭访客、私密 Room 直连拒绝、取消加入和网络失败。

本批不自动修补旧 Space 的 Room 数据；用户已改用 Web 创建两个测试 Space。先前待确认的旧 Space 数据恢复不再作为本批前置条件。

## 验证与下一步

164 项测试（29 文件）、根/Native 类型与依赖边界、127 项生产 Web 代理/API/Redis/Socket 集成检查、隔离标准 Web/API 构建及 iOS/Android JS 导出通过。既有 lint 警告保留。Native 刷新 Hook 测试放在 apps/mobile/tests，避免 RN 全局类型污染 Web/server 类型检查。

代码测试覆盖旧 env 存在/不存在时的发现、第二个 Space 的加入与授权、私密 Room 隐藏/拒绝、Web 私密订阅规则、目录刷新及请求清理。原生媒体互通和私密轨道隔离仍需要升级两端后进行实际 LiveKit 回归；单元测试和模拟媒体服务不等于此项验收。

现有上下分页只是信息浏览，点击后才正式加入。下一批处理会中上下切换 Space 与预览的交接：单一正式会话、退出确认、真实预览源和媒体授权、取消/快速滑动，再接入延迟加入。自动发现 Space 元数据不代表已授权公开转播参与者的音视频。

发布端权限接口依据 [LiveKit Track Subscription Permissions](https://docs.livekit.io/transport/media/publish/)；SDK 升级前重新验证行为。
