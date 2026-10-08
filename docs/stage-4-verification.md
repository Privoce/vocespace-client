# 阶段 4 首批交付与验证

第二批变更及最新验证见 [第二批记录](stage-4-batch-2.md)。以下保留首批验证快照。

日期：2026-10-08。范围：B0 初步盘点与 B1 第一批服务/SDK 抽取；不代表 B0–B7 全部完成。

## 交付

- `Agents.md` 入口与 `.agents/rules/` 四份规范，依据当前 components / app hooks 结构编写。
- 16 个 HTTP route、27 个 Socket 事件、数据/任务、迁移顺序及已知授权债务的盘点。
- contracts 入房 DTO 与运行时校验；domain 身份格式和共享白名单规则。
- server-core 通过配置、空间查询、令牌签发端口承接普通入房业务；Next 保留 HTTP、Cookie、平台重定向与错误映射，LiveKit SDK 位于服务端适配器。
- SDK 注入 baseUrl / fetch / 凭证，支持取消、错误映射和无自动连接的 Socket 工厂；Web 入房、聊天历史、退出兼容层已接入，保留 Response 返回值。
- 本地依赖边界检查与 GitHub Actions 配置；完整 workspace / 独立包发布留到 B3。
- 修复现有 ESLint 9 与 Next 14 / eslint-config-next 14 的兼容问题，将 ESLint 固定为其支持的 8.57.1 并更新锁文件；未升级框架、未关闭检查。

## 已执行检查

| 检查 | 结果与范围 |
| --- | --- |
| 修改前 `tsc --noEmit --incremental false` | 通过，作为本批基线 |
| `pnpm test` | 3 个文件、23 项测试通过；测试使用隔离配置、模拟存储与假签发凭证 |
| `pnpm typecheck` | 全项目通过 |
| `pnpm check:boundaries` | 通过；另临时加入 SDK 对 server-core 的转导出，确认检查拒绝后已删除探针 |
| 新增与相关路径 Next lint | packages、lib/server、tests、lib/api/client.ts、connection-details route 无 warning / error |
| 标准 `pnpm build` | 通过，包含 lint 和类型检查；仍有旧模块 Hook / 图片等存量警告 |
| `git diff --check` | 通过 |

检测到用户本地 3000 端口服务正在运行，因此生产构建使用当前源码的临时副本，复用安装依赖，使用不含实际凭证且 Redis 关闭的隔离配置；没有覆盖用户运行中的 `.next`。这证明打包/静态生成成功，不证明实际 Redis、LiveKit 或外部平台已通过联调。

测试分组：

- `stage4-connection.test.ts`：坏输入提前拒绝、DTO、identity、白名单创建/已存在房间、旧 white_platform 行为、配置/存储/签发失败。
- `stage4-sdk.test.ts`：无浏览器环境、部署前缀与特殊字符、认证更新、Response 兼容、退出请求、取消与不重试、错误映射、坏响应、Socket 独立所有权。
- `stage4-route.test.ts`：真实 Next 适配与本地 LiveKit 签发代码，验证响应、Cookie、五分钟 grant、参数错误、创建拒绝与平台响应格式；平台解析被模拟，不作为真实身份校验的证明。

## 有意保留与后续回归

旧端点与成员写入方不变，不改数据 schema，不启用新公网服务。旧身份/Socket/管理权限缺陷、敏感配置响应和登录 URL 仍是下一批迁移重点，见 [盘点](stage-4-baseline.md)。SDK 可注入认证不等于后端已经可信认证。

本批普通入房参数缺失先返回 400，再检查空间；媒体配置改为每个请求快照；原 region 参数继续兼容传递但未启用区域选择。这两处行为在后续真实服务回归中一并确认。

待后续联调：

- 普通/白名单创建、现有空间加入、平台跳转与自定义部署前缀。
- Web 收发聊天及退出后成员清理、Socket 重连与布局切换不重建会话。
- 配置变更后的 LiveKit 连接以及旧平台协议兼容。
- 独立后端、新认证、RN 与发现流均未实施；远程 GitHub Actions 尚未执行。

阶段 1、2 的回归完成来自用户本次确认，不能作为以上新增迁移的真实服务验证结果。当前 checkout 没有此前 34 项测试，不能用历史数字代替本批 23 项结果。
