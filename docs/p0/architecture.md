# P0 模块与依赖基线

日期：2026-09-15。代码基准：7af4969670aa1bbbd4f0e91c4896e348a47f153c，分支 feat/rebuild_docker_project_sys。本文记录现状；目标结构见 [rebuild.md](../../rebuild.md)。

## 1. 工作区范围

[初始状态](./evidence/initial-status.txt) 包含用户已有删除 avo.opt.md、wx_after_test.md，以及上轮生成的五份规划/贡献文档。本轮不恢复这两处删除，不修改业务实现。

P0 新增测试入口、测试、静态扫描及隔离构建脚本、基线文档和证据。Dashboard 不拆解，不更改其 UI、业务或状态，只在未来共享接口迁移时做必要兼容。

## 2. 可重现的静态清单

~~~bash
node scripts/p0-inventory.mjs > docs/p0/evidence/source-inventory.json
~~~

也可用 pnpm baseline:inventory 查看输出。扫描器用 TypeScript AST 解析 git 跟踪且仍存在的 app/lib/server/styles 源文件，不执行应用，不读取 .env、私有 JSON 或上传内容。

[完整清单](./evidence/source-inventory.json) 记录 210 个源代码/样式文件、1174 条静态 import/export、30 条引用 PageClientImpl 的静态依赖、2 条 lib → app 依赖，以及路由、Socket 调用、Room 事件和环境变量读取位置。

扫描不解析任意动态导入、变量别名或运行时负载；事件协议仍以人工核对的 [protocol.md](./protocol.md) 为准。行数按文本换行统计，仅作规模指标。

## 3. 模块清单

| 模块 | 当前入口 | 职责与依赖 | 后续任务 |
|---|---|---|---|
| 路由与全局 UI | app/layout.tsx、app/page.tsx | i18n、Ant Design、全局/LiveKit 样式、浏览器守卫 | P1/P3 |
| 空间路由 | app/[spaceName]/page.tsx | 平台参数、本地用户与客户端页面组合 | P2/P3 |
| 会话入口 | app/[spaceName]/PageClientImpl.tsx | 入会预览、token、Room、Socket、配置、离会、store 别名 | P2/P3 |
| 会议核心 | app/pages/controls/ | 布局、频道、控制栏、业务状态与大量监听 | P3 |
| 成员 | app/pages/participant/ | 轨道、菜单、成员权限、播放器、形象与特效 | P3/P4 |
| 聊天 | app/pages/chat/ | 文本、附件、链接预览；消息实际监听在视频容器 | P3 |
| 入会预览 | app/pages/pre_join/ | 表单、设备、登录与设置 | P3 |
| 设备组件 | app/api/devices/ | 客户端设备 UI，并非 route.ts API | P1 |
| 设置 | app/pages/controls/settings/ | 权限、AI、设备、配置、偏好 | P4 |
| 虚拟形象/模糊 | app/pages/virtual_role/、blur/ | Live2D、Pixi、媒体处理 | P4 |
| 应用工具 | app/pages/apps/ | 计时、待办、协作、固定应用、报告等 | P4 |
| 空间创建/录制 | app/new_space/、app/recording/ | 页面与业务状态 | P4 |
| Dashboard | app/dashboard/ | 管理页面与已抽出的组件 | 不拆解，P4/P8 冒烟 |
| 业务 API 客户端 | lib/api/ | 按业务包装请求，index 聚合出口 | P1 |
| 状态 | lib/store/ | 用户、空间、房间、许可证与用户选择 | P1/P2 |
| 业务 hooks | lib/hooks/ | 空间/平台业务；部分跨端或反向引用页面 | P1/P2 |
| 混合工具/类型 | lib/std/、lib/types.ts、lib/client_utils.ts | DOM、hooks、业务类型、配置、权限、上传等混合 | P1 |
| 服务端支持 | lib/db/、lib/email.ts、lib/s3-clean.js | Redis/许可证、邮件、对象存储清理 | P1/P6 |
| 自定义服务 | server.js、server/level.js | Express、Next、Socket.IO、Redis 聊天、静态上传、断线处理 | P2/P6 |
| API routes | app/api/**/route.ts | 空间、配置、token、聊天、录制、S3、许可证、Webhook 等 | 保持协议，P1/P6 调整边界 |
| 部署 | Dockerfile、entrypoint.sh、docker-compose.yml、deploy/ | 旧捆绑镜像、反代及安装说明 | P6 |

## 4. 关键依赖与状态所有者

当前方向包含：页面 → 视频容器 → 子组件；子组件及业务 hooks 又从页面获取 Socket/store 别名。lib/store 已存在，但页面仍作为兼容导出入口，不能仅移动文件就认为消除了耦合。

两处 lib 反向依赖：

- lib/hooks/space.ts → app/[spaceName]/PageClientImpl：取得 Socket；P1/P2 迁移。
- lib/email.ts → app/api/conf/conf：服务端邮件依赖路由目录中的配置实现；P1/P6 迁移。

页面模块顶层 io() 自动建立连接。video_container.tsx 集中注册多数业务监听，部分 cleanup 使用 socket.off(event) 而非指定 handler；tile_player_change_response 已使用具名 handler，应保留已有正确模式。

| 状态 | 当前所有者 | 迁移注意 |
|---|---|---|
| 连接与轨道 | LiveKit Room + 页面局部状态 | 不用 Socket 状态替代媒体连接状态 |
| Socket | PageClientImpl 模块级单例 | 迁到会话生命周期，更新全部消费者 |
| 用户偏好 | lib/store/user、localStorage | 保留 key 和版本处理 |
| 聊天/未读 | lib/store/room | chat 发送、video_container 接收，状态分散 |
| 用户状态/虚拟遮罩/远程应用 | lib/store/room | 多个页面别名指向同一 store，不是独立 store |
| 入会选择 | usePersistentUserChoices 与页面 state | 保留默认设备启用语义 |
| 主动离会/卸载尝试 | lib/roomLeaveIntent.ts | 两个独立模块级标记，不混为同一事件 |
| 配置 | JSON、STORED_CONF、路由模块初始化读取、server 独立读取 | 目前不是统一动态配置源 |

## 5. 已有行为契约

- LiveKit 首次连接后启用退出确认并调用视频容器清理入口。
- onDisconnected 先关闭确认；只有 consumeExplicitLeaveIntent() 返回 true 才执行主动离会 API、清理、Socket 断开和回首页。
- BeforeUnloadGuard 拦截 beforeunload；在页面可见的 focus/pageshow/visibilitychange 后清除卸载尝试，卸载时清理监听。
- 频道内成员允许全部轨道；频道外成员仍可订阅相机和屏幕共享轨道。这是当前行为，不能在结构重构中默认为完全隔离。
- 文本发送前 trim，空文本不发送；先更新本地消息，再 emit，不存在送达确认。
- 文件回复按 id 去重；文本回复无等价 id 去重。重连迁移要避免重复监听导致重复消息。
- 用户偏好使用 vocespace_participant_settings、vocespace_platform_user，以及 LiveKit 的 lk-user-choices；页面会检查 0.5.5 版本，保留现有清理语义。

## 6. P0 不包含的验证

静态扫描不证明权限安全或网络行为正确。jsdom 测试不证明真实设备、WebRTC、TURN、录制或多浏览器通话通过。真实流程步骤见 [manual-regression.md](./manual-regression.md)，执行留给具有隔离测试环境的后续阶段。
