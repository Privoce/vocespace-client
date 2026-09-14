# P0 完成报告与工程基线

日期：2026-09-15。代码基准：7af4969670aa1bbbd4f0e91c4896e348a47f153c；本轮只实施 P0。

**P0 的完成含义是：已记录当前结构与工程结果、建立可运行行为测试和人工回归步骤。它不表示现有应用所有检查通过，也不表示 P1–P8 已执行。**

## 1. 四项交付与证据

| 任务 | 交付 | 证据 |
|---|---|---|
| P0-01 | 模块、依赖、状态、Dashboard 边界与初始工作区 | [架构基线](./architecture.md)、[静态清单](./evidence/source-inventory.json)、[初始状态](./evidence/initial-status.txt) |
| P0-02 | 安装、类型、lint、build 的命令/版本/退出码及已有问题 | 本报告、[初始环境](./evidence/environment.json)、[后续检查结果](./evidence/checks-after.json) |
| P0-03 | Vitest/RTL 测试入口、19 个行为测试、双浏览器步骤 | [Node 24 测试日志](./evidence/test-node24.log)、[手工回归](./manual-regression.md) |
| P0-04 | 三份规划、贡献规范、配置与 Socket 协议、事件语义 | [协议基线](./protocol.md)、[阶段计划](../../plan.md)、[贡献规范](../../CONTRBUTION.md) |

## 2. 工具链和复现命令

初始环境是 Node 18.20.4 + pnpm 10.27.0；P0 同时验证本机已有 Node 24.12.0，并在 .nvmrc 固定该开发版本、packageManager 固定 pnpm 10.27.0。package.json 原有 engines >=18 保持不变，不据此承诺所有 Node 版本或部署镜像已经验证。

测试依赖固定：Vitest 3.2.4、Vite 6.3.5、jsdom 26.1.0、React Testing Library 16.3.0、DOM Testing Library 10.4.1。Vite 显式固定为 6，避免 Vitest 的宽范围依赖自动选择不兼容初始 Node 18 的 Vite 7。没有升级 React、Next.js 或 LiveKit 的直接版本；pnpm 重新解析了新增测试依赖与可选 peer 关联。

~~~bash
nvm use
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:watch
pnpm lint
pnpm baseline:inventory
pnpm baseline:build
~~~

首次安装需访问 registry；已经缓存依赖时可附加 --offline 验证 lockfile。P0 已通过后者，但不宣称全新无缓存机器已离线安装通过。

测试配置显式设置 jsdom、路径别名、JSX 转换和测试后 cleanup。未加入 Playwright 运行器或真实媒体 E2E；P0 的双浏览器交付为回归步骤。

来源：[Vitest 3 文档](https://v3.vitest.dev/guide/)、[Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/)。

## 3. 工程结果

| 检查 | 环境 | 退出码 | 结果 / 证据 |
|---|---|---:|---|
| 修改前 pnpm install --frozen-lockfile | Node 18.20.4 | 0 | 已有依赖可安装；[日志](./evidence/install-before.log) |
| 修改前 tsc --noEmit --incremental false | Node 18.20.4 | 0 | 类型检查通过；[结果](./evidence/typecheck-before.json) |
| 修改前 pnpm lint | Node 18.20.4 | 1 | ESLint/Next lint 选项不兼容；[日志](./evidence/lint-before.log) |
| 修改前 pnpm build（隔离源码副本） | Node 18.20.4 | 0 | 产物生成，但有 lint/配置/Redis 告警；[结果](./evidence/build-before.json)、[日志](./evidence/build-before.log) |
| 新增 pnpm test | Node 18.20.4 | 0 | 4 文件、19 测试通过；[日志](./evidence/test-node18.log) |
| 新增 pnpm typecheck | Node 18.20.4 | 0 | 测试与配置类型通过；[日志](./evidence/typecheck-after.log) |
| 修改后 frozen-lockfile --offline 安装 | Node 24.12.0 | 0 | 使用已有缓存通过；[日志](./evidence/install-after.log) |
| 修改后 pnpm test | Node 24.12.0 | 0 | 4 文件、19 测试通过；[日志](./evidence/test-node24.log) |
| 修改后 pnpm typecheck | Node 24.12.0 | 0 | 类型检查通过；[日志](./evidence/typecheck-node24.log) |
| 修改后 pnpm lint | Node 24.12.0 | 1 | 相同配置不兼容，未隐藏或禁用规则；[日志](./evidence/lint-after.log) |
| pnpm baseline:build | Node 24.12.0 | 0 | 产物生成；原 lint 与未配置服务告警仍在；[结果](./evidence/build-after.json)、[日志](./evidence/build-after.log) |

构建采用干净源码副本，共享已安装 node_modules，不复用开发者 .next，也不复制私有环境、配置或上传状态。baseline:build 还过滤继承的应用环境变量，并保留临时副本用于诊断。因此此结果证明无部署配置的源码可生成构建产物，不能证明真实配置、生产启动或媒体可用。

## 4. 已有问题登记

| 编号 | 分类 | 证据与影响 | 后续处理 |
|---|---|---|---|
| B01 | 工具配置 | Next 14 的 next lint 传入 ESLint 9 已移除的 useEslintrc/extensions 等选项；独立 lint 退出 1 | P1-05 对齐 lint 工具链；P0 保留失败基线 |
| B02 | 构建状态 | next build 打印 ESLint 错误仍退出 0；产物成功不能代替独立 lint | P1-05/P8 检查分别报告，不以 build 代替 |
| B03 | 配置/环境 | 无 JSON 时产生 ENOENT；默认配置启用 Redis，路由导入时连接 localhost:6379，在当前沙箱报 EPERM | P6-01/P6-03 统一配置和服务初始化；本次无 Redis 集成验证 |
| B04 | 依赖兼容 | 已有 LiveKit components-core 与 client 的 peer 范围不匹配，Next ESLint、react-notion-x 的部分 peer 也不匹配 | 记录但不顺带升级 SDK；相关迁移阶段实测 |
| B05 | 架构/资源 | 页面导入即建 Socket；30 条 PageClientImpl 引用，2 条 lib→app；部分 off(event) 清理全部消费者 | P1/P2 迁移和监听生命周期验证 |
| B06 | 配置接口 | clearReadableConf 透传含密钥的 LiveKit 配置，record env 路径返回 S3 凭据；配置 POST 分支认证不一致 | P6-01 收窄字段并核对调用；P0 不修改协议 |
| B07 | 部署 | Docker 配置文件名不匹配、捆绑 ARM64 LiveKit、standalone 与自定义服务不一致，入口写密钥并输出配置 | P6 镜像与运行配置重建 |
| B08 | 频道 hook | 普通 volume=0 经 “/100 或 1” 回退为 1；fetchSettings 完成后 emit 没有卸载取消保护 | P2/P3 行为修复单独登记，不将其写成正确期望 |
| B09 | 安装/资源 | pnpm 提示若干原生依赖构建脚本被忽略；P0 不全局 approve-builds；浏览器数据有过期提示 | P6 按镜像/功能验证必需原生能力，避免扩大本轮变更 |

B01–B09 均未在 P0 修复。新增测试及 typecheck 已通过，没有通过放宽规则或修改应用实现消除失败。

## 5. 测试覆盖与局限

| 文件 | 数量 | 覆盖 |
|---|---:|---|
| tests/room-leave-intent.test.ts | 4 | 主动离会只消费一次、取消、与卸载尝试独立 |
| tests/before-unload-guard.test.tsx | 7 | 确认拦截、禁用、focus/pageshow/可见性恢复、StrictMode 卸载清理 |
| tests/debounce.test.tsx | 4 | 初始值、最新值、延迟变化、卸载取消 |
| tests/room-subscription.test.ts | 4 | 未连接/无频道、不同频道权限、音量、刷新后广播顺序 |

room-subscription 只 mock 页面导出的 Socket 边界，防止测试导入时联网；hook 和 LiveKit 枚举保持真实，Room/参与者使用内存替身。它不验证媒体流、Socket 服务端转发或完整会话 Provider。

P0 未运行：真实浏览器确认框、双端媒体、平台直入、跨网络重连、TURN、Egress/S3、Umami、生产配置及 Dashboard 实例冒烟。这些在手册和后续阶段中保留为待执行，不阻止本次“建立入口与步骤”的 P0 完成。

## 6. 工时和阶段状态

P0 原人工预算保留为 8 day / 16 小时，基础总预算仍为 128 day。此次是代理执行，实际耗时不按原人工预算填充；不据此将全部后续人工估算缩短。未逐项计时，任务实际 day 留空，证据中的秒数仅表示对应命令运行时间，不等于工程投入。

P0-01–04 完成；P1–P8 保持待开始。后续进入 P1 时先利用本基线核对新增错误，并处理 B01 的检查工具兼容性。
