# Mobile 构建配置与 Deploy 分支选择

## Mobile 配置来源

技能源码现位于 `.agents/skills/vs-mobile-build`。技能、构建指南和 `apps/mobile/app.config.js` 统一使用仓库根 `vocespace.deploy.conf.json`；本机原有同名全局技能也已同步。

本地将部署配置投影为公开 Mobile / analytics 字段；没有部署配置时使用 `apps/mobile/vocespace.public.json`，没有投影则失败。不再读取 `vocespace.conf.json`，避免开发配置覆盖发布地址。EAS 构建前运行 `node scripts/config.mjs public --config vocespace.deploy.conf.json`。

本轮已重新导出，并通过 Expo public config 验证 API 为 `https://vocespace.com`、`meetingUiPreview` 为 false、analytics 开启。私有文件由现有 Git ignore 排除，未复制到技能、文档或客户端；隔离测试使用哨兵验证私有字段不会进入 Expo 输出。

## 本机部署配置检查

这是 2026-11-15 对本机文件的静态检查，不代表服务器使用同一份配置或远程服务联调通过。仅检查并报告，未修改该私有文件。

| 字段 | 结果 |
| --- | --- |
| `deployment.mobile.apiUrl` | `https://vocespace.com`，HTTPS 格式正确，与当前公开投影一致 |
| `deployment.mobile.meetingUiPreview` | false，类型有效；不能据此判断 HLS 服务是否可用 |
| `analytics` | 开启，地址 `https://rds.vocespace.com`，websiteId 已填写；未发送统计事件验证 |
| `livekit.url` | `wss://vocespace.com`，安全 WebSocket 地址；未连接实际 RTC |
| `preview` | 已开启，renderer 为 `https://vocespace.com/`，S3 bucket/region/accessKey/secret 已填写。空 s3Endpoint 采用 AWS 默认端点；若实际使用兼容 S3 服务，需配置相应端点 |
| `deployment.publicOrigin` | **仍是 `http://localhost:3000`，不适合作为线上来源**；用于正式服务时应设为实际公开 origin，当前主站为 `https://vocespace.com` |
| `account.publicUrl` | **仍是 `http://127.0.0.1:3000`**；基于该地址的线上账号链接/回调流程会被生产 HTTPS 校验拒绝。应设为实际账号公开地址；若账号端点位于主站，则使用 `https://vocespace.com` |

后两个字段不会作为 Mobile API 地址写入包，因此不阻止原生编译；服务端若使用这份配置则仍需修正。`deployment.web.apiUrl` 的 `127.0.0.1:3001` 是 Web 到本机 API 的内部代理地址，不应机械改为公网地址。

## Deploy 行为

创建与更新发布都必须选择分支。登录后从固定仓库 `https://github.com/Privoce/vocespace-client.git` 查询远程 heads，页面使用 select；加载失败、未选择或有任务运行时禁用发布。刷新保留仍存在的选择；历史任务显示分支。

任务校验分支名、origin 仓库和版本名，在现有部署锁内依次执行：

```text
git fetch --no-tags origin +refs/heads/<branch>:refs/remotes/origin/<branch>
git reset --hard refs/remotes/origin/<branch>
git rev-parse HEAD
deploy.sh build ...
deploy.sh activate ...
```

分支通过独立进程参数传递，不拼接 shell。不存在的分支导致 fetch 失败；fetch/reset/build 任一步失败都不激活。reset 覆盖已跟踪文件本地修改，并可能移除阻挡检出的未跟踪路径；不另外运行 git clean。使用专用部署 checkout。回滚和删除保持不接受分支的原行为。

只读查询取得 13 个远程分支。没有对本机项目或服务器执行 fetch/reset、上线或重启。使用新界面需更新服务器源码，执行 `pnpm build:deploy` 并重启 Deploy 服务。

## 验证

- 13 项 Deploy 测试通过，覆盖鉴权、输入校验、查询错误、worker 参数传递和原有回滚/删除保护；其中临时仓库真实 Git 测试确认远程分支覆盖分叉提交及未提交文件，不存在的分支不会构建。
- 1 项移动构建配置测试通过，覆盖部署配置优先、忽略开发配置、云端投影回退、缺配置失败及秘密隔离。
- 9 项 Vitest 测试通过：分支 select 创建/更新请求、刷新失败禁用，以及现有 JSON 配置回归。
- Deploy 标准构建、根/Mobile 类型、依赖边界、技能结构和差异空白检查通过。
- 未执行真实服务器发布、手机原生打包、设备安装或生产账号/媒体回归。
