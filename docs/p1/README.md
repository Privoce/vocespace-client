# P1 完成报告：lib 分层与公共接口

日期：2026-09-15。基于 P0 工作区实施；P1-01 至 P1-05 已完成。本次没有开始 P2 的 Socket/会话重构，也没有执行真实双端通话。

## 交付与验收

| 任务 | 交付 | 验收证据 |
|---|---|---|
| P1-01 | lib 按能力域提供入口，业务在 features、服务实现在 server | [lib 公共接口](../../lib/README.md)、[依赖检查](./evidence/boundaries.json) |
| P1-02 | 拆分混合工具、类型和 AI 模块；迁移防抖、节流、尺寸/模糊 hooks | [文件/符号映射](./evidence/migration-map.json)、[46 项测试](./evidence/tests-node24.log) |
| P1-03 | 提取 DeviceList、泛型分页；设备 UI 移出 API；保留原样式与交互 | [迁移说明](./migration.md)、设备选择/分页行为测试、分页 SCSS 原文比较 |
| P1-04 | API/store 归属业务，配置/邮件/JWT/存储/AI 归属服务端；lib 不再反向依赖页面 | [源码清单](./evidence/source-inventory.json)、[协议与兼容核对](./evidence/compatibility.json) |
| P1-05 | 依赖扫描、SSR 导入、server-only 保护；六个旧通用入口兼容 | [边界反例及 SSR 测试](./evidence/tests-node24.log)、[构建](./evidence/build-node24.log)、[兼容表](./migration.md) |

45 个完整模块迁移，另拆分 3 个混合模块。当前扫描覆盖 245 个源码/样式文件；边界检查覆盖 226 个 JS/TS 模块。lib→app 引用从 2 降为 0。全应用仍有 30 个 PageClientImpl 引用，均在业务/页面层，归 P2 收敛。

## 工程验证

环境：Node 24.12.0、pnpm 10.27.0。用户的 normal 别名对应该 Node 版本；仓库 .nvmrc 固定同一版本。此轮未重复验证 Node 18。

| 命令/检查 | 退出码 | 结果 |
|---|---:|---|
| pnpm install --frozen-lockfile --offline | 0 | 使用现有缓存验证 lockfile，[日志](./evidence/install-node24.log) |
| pnpm typecheck | 0 | 应用、模块和新增测试类型通过，[日志](./evidence/typecheck-node24.log) |
| pnpm test | 0 | 10 文件、46 测试通过；保留 P0 的 19 项，新增 27 项 |
| pnpm lint（同参数 JSON 输出） | 0 | 0 错误、111 个历史警告，[明细](./evidence/lint-final.json) |
| pnpm check:boundaries | 0 | 226 模块、186 个客户端/共享可达模块，0 违规 |
| pnpm baseline:build | 0 | Next 生产编译、类型/lint、页面生成完成；含配置和 Redis 的既有告警 |
| pnpm baseline:inventory | 0 | 新脚本覆盖 tracked/untracked 与 features；历史 P0 清单保持原样 |
| 路由与事件静态对照 | 0 | 路由文件列表、Socket/RoomEvent 的事件名/方法/参数数量与 P0 相同 |
| git diff --check、文档链接、任务合计 | 0 | 见 [交付检查记录](./evidence/checks.json) |

新增测试涵盖：通用 UI 受控选择/分页、设备过滤与优选项、轨道/Room 切换、权限失败、临时轨道停止、卸载清理、URL 查询编码、props 合并、SSR 公共入口、历史导出等价、架构违规反例，以及模糊/指针特效的清理。

本机 PATH 中有另一个 pnpm 版本，因此本轮命令实际使用已有的 pnpm 10.27.0 可执行文件，并由 Node 24 运行。复现时先检查 `node -v` 和 `pnpm -v`，不要仅凭 nvm 切换推断包管理器也已切换。

~~~bash
nvm use normal  # 或 nvm use，读取仓库 .nvmrc
node -v
pnpm -v        # 应为 10.27.0
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm check:boundaries
pnpm baseline:build
~~~

baseline:build 复制当前源码到临时目录，包含新 features，使用当前 Node 直接执行仓库安装的 Next CLI。它不读取部署 .env、私有配置或上传状态，也不覆盖开发 .next；它验证的是未配置源码构建，不是已部署实例。

## lint 修复的范围

P0 的 lint 在工具选项解析阶段失败。本轮将 ESLint 固定为与现有 Next 14 检查入口可用的 8.57.1 后，先保存了 [迁移前诊断](./evidence/lint-before.json)：44 错误、111 警告。

没有禁用 lint 规则。普通平台查询函数去掉 use 前缀；修正 forwardRef 组件名称、JSX children/key、条件 Hook 调用和一个无效的历史规则注释。条件 Hook 修正涉及的指针特效同时补齐配对清理，避免开关组件时遗留监听；具体修改见迁移说明。

111 个现有警告主要涉及 effects 的依赖数组、原 img 用法和默认导出。它们保留为后续模块拆解的待处理项，没有把 0 错误描述为全量无告警。

## 限制与后续

- 真实浏览器设备、普通/直入流程、Dashboard 操作和双端音视频没有在本阶段人工执行；SSR、组件测试和构建不能代替这些验收。沿用 [人工回归步骤](../p0/manual-regression.md)，由 P2–P4/P8 验证。
- 隔离构建仍显示缺少 vocespace.conf.json 与 Redis 连接 EPERM；这是无私有配置且服务不可达的已知基线，不代表线上 Redis 健康。P6 处理配置和健康检查。
- 依赖安装仍存在原 LiveKit/Notion peer 警告和被 pnpm 跳过的依赖构建脚本。没有升级 LiveKit、React 或 Next 的直接版本来消除它们。
- 配置响应脱敏、录制凭据接口、Socket 单例、其他媒体取消与大组件拆解按原计划继续。本轮 server-only 仅解决代码导入边界。
- 六个通用兼容入口保留到 P8；业务旧入口的外部分支合入需按迁移表更新导入。

## 工时与工作区

P1 原预算 16 day / 32 小时保留，不把 agent 运行时长视为一名开发者的人工投入。未逐项计时，实际 day 为“—”，后续可由贡献者补记。没有据此消耗风险缓冲或修改其余阶段估算。

没有创建提交或 PR。保留 P0 文档和测试，用户原有 avo.opt.md、wx_after_test.md 删除状态保持不变。
