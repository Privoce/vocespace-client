# Native 会中页面与设备邀请（4.4，2026-10-10）

> 后续更新（2026-10-11）：下文记录早期批次。当前已支持配置的多个 Space、公开子 Room 与独立屏幕邀请；旧的「无子房间/禁止屏幕发布」限制及后台规则以 [新交付](mobile-navigation-controls.md) 为准。私密 Room、E2EE、公开发现及真实预览仍未开放。

用户已确认原有手动入房可用。本批按 Web PC 的会中功能结构实现原生页面与设备邀请，仍沿用指定、无子房间测试 Space 的范围。未开启公开发现或引入账号体系。

## 本批实现

- 画面、成员、聊天三个面板，摄像头占位、说话状态、视频固定放大、共享屏幕优先显示。设备和退出按钮位于固定底栏。切换面板保留同一个 RTC 与聊天连接、消息和草稿。
- App 举手使用已有 Web 事件。服务端填写真实 senderId、senderName、senderSocketId；Web 主持人可同意举手或在成员菜单邀请开启麦克风/摄像头。
- 邀请只显示提示，不自动采集。App 用户点击接受后，API 校验成员、RTC metadata、邀请有效期及邀请人当前会话和管理权限，才更新 LiveKit 的单设备发布权限。客户端等待 RTC 权限同步后请求本机设备。
- 初始 RTC token 保持 `canPublish:false`。Native 无主持权限，禁止自行邀请、发布屏幕/数据或通过旧接口提升权限。摄像头与麦克风分别授权；已获准的设备可自行开关，主持人撤销后须重新邀请。
- 正在开启或使用麦克风/摄像头时，退出、切 Tab、Android 返回会先确认；取消保持原会话。普通观众直接退出。确认窗口去重，迟到确认不能退出下一间会议。
- 权限弹窗导致的 `inactive` 保留会议；真正进入后台会停止现有采集、等待不可取消的系统权限操作结束、清理其迟到轨道，再释放 RTC / AudioSession 和业务成员。清理失败继续保留重试入口。
- Web 主持人的关闭设备命令直接在媒体服务撤销对应 source，不能只依赖客户端 UI。客户端监听权限变化及 Socket 撤销通知，关闭本地设备。

UI 使用 `#22CCEE` 与 `@ant-design/react-native`。Web 的 DOM、AntD Web 组件和 React 18 Hook 未导入 RN；复用的是协议、权限规则和会中功能组织。

## 代码边界

| 位置 | 职责 |
| --- | --- |
| `apps/mobile/src/conference/MeetingRoom.tsx` / `useMeetingRoom.ts` | 会中视图与展示状态 |
| `media-controller.ts` / `room.ts` | 授权、采集、权限等待、停止与迟到轨道清理 |
| `leave-guard.ts` / `useConference.ts` | 稳定会话所有权、离开确认、后台/返回键行为 |
| `apps/mobile/src/chat` | 同一个 Socket 承载聊天、举手及设备通知，退出统一清理 |
| `packages/contracts/src/native-media.ts` | JSON 契约、设备白名单与运行时校验 |
| `packages/server-core/src/native-media.ts` | 邀请接受规则 |
| `services/api/native-media.ts` / `lib/server/native-media.ts` | HTTP 适配与 Redis、会话、媒体服务组合 |
| `lib/server/media-lock.ts` | 单 API 写入者内，按 Space/identity 串行授权、撤销及媒体退出 |

## 协议和存储

新增 Native JSON Bearer 接口（浏览器 Cookie 不参与授权）：

- `POST /api/v1/native/media`，`{joinId}`：返回 `{sources, invitations}`。不会开启设备。
- `PUT /api/v1/native/media`，`{joinId, device, invitationId}`：接受单设备邀请；device 只允许 `microphone` 或 `camera`。已获授权时可重试，不重复扩大权限。
- Web 的 `raise_accept` 和 `invite_device` 转换为 `native_media_invitation`；关闭命令在服务端撤销后通知 `native_media_revoked`。重新连接 Socket 时 App 补读状态，避免丢失邀请提示。

邀请存于 `v1:native-invite:<principalId>:<joinId>:<device>`，TTL 60 秒，含邀请人会话引用用于接受时重验；返回客户端的 DTO 不含该引用。使用后的邀请被删除，接受权限以 LiveKit 当前 source 白名单为准。离开后的旧邀请即使尚未过期，也不能越过已取消的 join 或成员检查。

Native Socket 握手将当前 Socket ID 以 CAS 写入既有成员数据，使 Web 成员菜单可以定位手机连接。重连更新该值，退出随成员一起删除；不另建用户体系。

授权与退出协调沿用当前“单 API 写入者”部署约束；此进程内串行机制不支持多 API 实例。会话中途过期/进程被杀后的完整媒体补偿、初始 token 重放、worker 对账仍是已有待办，不能据此宣称公开生产授权闭环完成。

## 验证结果

- 100 项单元/Hook 测试通过；新增覆盖精确设备邀请、过期和管理权限判断、授权失败不采集、重复点击合并、退出/撤销期间的迟到采集、后台及时停音频、清理失败重试、旧状态覆盖防护和退出确认竞态。
- 99 项生产 Web 代理 + 独立 API 制品 + 临时 Redis + 模拟媒体管理接口集成检查通过；覆盖 Web 同意举手、邀请人降权、麦克风/摄像头独立授权撤销、Native 自邀/屏幕/旧接口拒绝、退出后的迟到授权拒绝。
- 根与 Native 类型检查、依赖边界、相关 lint、API 构建/最小制品、iOS/Android JS 导出通过。Web 源码未改，代理验证复用已有独立 Web 生产制品。
- 尝试在独立 iPhone 17 / iOS 26.2 development build 与临时 LiveKit 上验证新界面。模拟器 UI 读取连续两次自动审批超时，因此新会中页面和真实设备采集未验收；没有批准或开启电脑/手机麦克风、摄像头。本批未新增原生依赖，既有 iOS 编译证据不冒充本批真机验证。

之前的视频接收/双向文字 POC 见 [会议聊天交付](native-conference-chat.md)，其结论不自动覆盖此次新增设备采集。隔离工具 `tests/manual/native-pilot.mjs` 已增加接收举手、邀请麦克风/摄像头、撤销麦克风按钮，后续可继续用于真实 SDK 联调。

## 回归步骤

1. 更新并重启独立 API，重新加载 `pnpm dev:mobile`。配置沿用现有 `NATIVE_CONFERENCE_SPACE` 和 `EXPO_PUBLIC_API_URL`，无需为本批新增配置或仅因 JS 变化重新 prebuild。
2. Web 主持人和 App 加入同一个测试 Space。检查画面/成员/聊天切换、聊天草稿保留、屏幕共享优先、固定/取消固定、成员设备状态与固定底栏。
3. App 点击“举手发言”，Web 同意。App 应只出现邀请，不自动开麦；点击“接受并开启麦克风”后才处理系统权限。分别测试拒绝、允许、重试、自行关闭/重开。
4. Web 单独邀请摄像头。确认未获邀请不能开摄像头；开启后 Web 能收到实际画面。关闭麦克风不能撤销摄像头，反之亦然。
5. Web 关闭设备权限，确认 App 立即停止采集，旧邀请不能重新开启；测试邀请过期、主持人降权、踢出及 Socket 重连。
6. 开启设备时退出、切 Tab、Android 返回：选择继续应保留原会话；选择退出应停止发布并清理成员。重复点击不能重复弹窗。权限请求过程中进入后台/退出后，也不能出现晚到轨道继续发布。
7. 观众直接切 Tab；再加入后测试后台、前台、断网重连和 API 暂时不可用后的重试。真机确认麦克风/摄像头指示灯结束，Web 侧无残留成员。

仍待完成：真机双端采集、音频路由、前后摄像头切换、网络切换验收，以及 4.5 的真实预览、上下滑动与延迟加入。App 当前不提供屏幕发布、主持/录制管理、Web 文件/白板/AI 工具，因此这些能力未标为已移植。
