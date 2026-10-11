# @vocespace/domain

Web 与 API 共用的旧业务模型、默认值和纯规则。2026-10-11 从根 lib 提取，保留原有 Space/成员/子 Room 数据结构及默认两个公共 Room 的行为。

- `model`：角色、状态、旧平台用户展示结构与兼容校验。昵称生成的 identity 不是认证凭证。
- `space`、`virtual`、`license`、`config`：旧数据模型、默认值和纯计算，不读部署文件。
- `ai`、`socket`、`chat`、`s3`：数据形状；不持有 SDK 实例。
- `requests/*`：旧管理 API 使用的请求形状，暂时关联旧领域模型。新 API 的 JSON DTO / 校验继续放 contracts，不能把这些兼容接口视为授权校验。

原 identity 格式函数已进入 contracts/legacy-identity；创建白名单授权规则进入 server-core/creation-whitelist。

不依赖 React、Ant Design、LiveKit、文件系统、网络或应用源码。日期兼容计算使用 dayjs；当前 Space 默认值包含旧时间/随机头像初始化行为，本轮保留语义。浏览器下载、设备采集、RTC VideoPreset、证书展示解码在 apps/web，配置读写、AI 请求和持久化在 services/api。
