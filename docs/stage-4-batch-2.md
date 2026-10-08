> 本文记录前一批 B1 交付。平台会话、独立 API 与任务迁移的后续结果见 [4.2 交付说明](stage-4-b2.md)。

# 阶段 4 第二批：Space 存储与配置授权

日期：2026-10-08。承接 B1，尚未完成独立后端部署、统一平台/访客身份和 Socket 授权。

## 本批变化

SpaceManager 从 `app/api/space/route.ts` 移到 `lib/server/legacy-space-manager.ts`，原成员、子房间、角色、历史、日志与退出流程保持兼容。这个类仍是迁移中的旧业务门面，不是已经平台无关的 server-core。HTTP 动作分发与 heartbeat 仍留在原路由，尚未搬到 worker。

基础 Space 读写进入 `packages/server-core/src/space-repository.ts`，通过端口依赖存储；`lib/server/space-repository.ts` 负责现有 Redis key 与 JSON 适配。保留 `space:<name>`、`space:list:` 和原历史/聊天 key，不新增第二份业务数据。保存 Space 与索引使用 MULTI 并检查每个命令的结果；这不解决整份 Space 读改写的并发覆盖，也不意味着 Redis 命令错误能自动回滚。

Next 内的 Space Redis 连接改为懒创建，并在同一进程跨路由/开发模块重载复用。配置在首次创建时固定，改变 Redis 连接配置需要重启服务；server.js 的聊天 Redis 客户端仍独立，后续服务整合时再处理。

入房服务直接读取同一个 repository，移除对本机 `/api/space` 的 HTTP 回调。空间不存在返回 null；Redis 关闭/不可用、存储内容损坏返回 503，不再当作允许创建的条件。旧 SpaceManager 兼容方法仍保留 null/false 等失败返回，后续迁移要逐项替换，不能把本次入房的严格错误行为泛化到全部旧接口。

## 配置与凭证边界

- 未提供有效 hostToken 的 `/api/conf` 响应中，LiveKit 管理 key / secret 返回空字符串以保留字段结构；连接 URL 和客户端需要的 TURN 配置保留。
- 已验证管理员仍可读取管理字段。Web 读取优先通过 `x-vocespace-host-token` 传凭证，服务端保留旧 query 兼容。
- 已初始化实例的整份配置覆盖、AI、创建策略、SMTP、Hyperbeam 写入在服务端校验 hostToken。初次配置仍允许初始化；覆盖/轮换时必须提供当前凭证，不能用拟设置的新 hostToken 证明权限。
- Web 控制器与 API 兼容层已传递凭证，保留旧 SMTP/Hyperbeam body 方式，同时支持 header。
- `/api/record?env=true` 只返回 configured、bucket、region 和服务地址，不再返回 S3 accessKey / secretKey。录制 hook 改为消费能力配置，失败不再一直停在加载状态，卸载时取消请求并忽略迟到结果。
- server.js 启动日志不再输出 Redis 密码原文。

新旧前端与后端应一起发布并刷新旧页面缓存：旧录制前端依赖已移除的 S3 凭证字段，不能保证旧 bundle 与新响应兼容。修改受保护配置的外部脚本也必须补上有效 hostToken。数据库无需迁移。

## 授权矩阵：已落实与仍待处理

| 入口 | 本批服务端行为 | 后续范围 |
| --- | --- | --- |
| conf GET，无/错误凭证 | 公开配置，隐藏实际管理密钥 | 进一步区分完整公开能力 DTO 与管理员 DTO |
| conf GET，有效凭证 | 返回管理配置；不存储新会话 | 管理员登录会话与凭证轮换策略 |
| conf POST check | 非空字符串凭证与当前配置比较；无写入 | 统一管理员身份服务、限流 |
| conf POST setup | 初次配置开放；已配置覆盖要求当前凭证 | 安装引导/初始化事务、配置字段完整校验 |
| conf POST ai / create_space / smtp / hyperbeam | 有效 hostToken 后执行；失败 403 且不写入 | 类型化命令与服务迁移 |
| conf POST RTC 画质 / license / room_license | 保留原行为，本批未新增授权 | 房间身份与所有权、许可证有效性规则定稿后迁移 |
| record GET env | 只返回能力字段，不给 S3 密钥 | 标准版本化能力契约 |
| record POST、S3 查询/删除 | 未改变原授权 | 与正式会话/房间授权合并 |
| connection-details 普通入房 | 创建策略不变，直接查存储；存储故障 503 | 客户端 identity 不能再充当可信身份，需受控访客会话 |
| 平台 token / 跳转 | 保留旧兼容路径 | 配置可信签名来源、拒绝验签失败、一次性 code 换会话 |
| Space / Socket 管理与成员事件 | 存储归属已抽取，原授权未整体替换 | 动作级身份矩阵、服务端频道权限、幂等与权限撤销 |

本次已询问平台是否可配合服务器配置的签名密钥；确认前保持旧平台协议。没有把 SDK 的 auth 注入或已签发 RTC token 当成可信身份方案，也没有启用发现流自动加入。

## 验证

- `pnpm test`：7 个文件、49 项测试通过。
- `pnpm typecheck`、`pnpm check:boundaries`：通过。
- 相关模块 Next lint：无 warning / error。
- 标准 `pnpm build`：通过，包含 lint / 类型检查；全站仍有旧模块的存量警告。
- `git diff --check`：通过。

测试不连接实际 Redis、LiveKit、S3 或外部平台；使用隔离存储、配置和假凭证。生产构建在临时源码副本执行，Redis 关闭，不覆盖用户运行中的 3000 端口服务和 `.next`。

新增覆盖：旧 key 与双入口一致性、坏数据/存储失败、事务命令错误、特殊名称、成员初始化/角色转让/子房间/退出、临时房间删除、懒连接与模块重载、敏感写入拒绝、初始化与凭证轮换、公开密钥过滤、录制能力响应和卸载竞态。

仍需实际服务回归：普通/白名单加入；Redis 故障时提示；角色转让、持久/临时房间退出与历史；管理员修改 AI/创建策略/SMTP/Hyperbeam；首次配置与已有配置覆盖；录制列表/下载及同版本部署。平台登录和统一 Socket 授权需另行联调，之前用户确认的回归不覆盖这些新改动。
