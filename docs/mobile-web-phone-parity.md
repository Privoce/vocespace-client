# Mobile 与 Web Phone 内容对齐（2026-10-11）

本批以已有 Web 内容和图标为来源。公共库不导入 Web DOM、LiveKit 或端内状态；Web PC 原布局、DOM class、Ant Design 控件与操作保留。Web Phone 的 Channel 改为左侧 Drawer 是本次明确要求。

## 实施对应

| 用户要求 | 代码落点与实际行为 |
| --- | --- |
| ParticipantList | 从 Web 抽出 `participantRowContent`，共享姓名头像配色算法；Native 成员列表显示公开 Space 成员、房主/管理员、麦克风/摄像头状态，支持姓名搜索和分享。Web 原右键菜单与管理操作保留。 |
| Tile 小部件 | `tileWidgetsContent` 来自 Web `AppFlotIconCollect` 的顺序。Native 提供聚焦/取消聚焦、全屏/关闭全屏、本人 AVO 设置、公开同步应用入口；视频复用现有轨道，不新建会议连接。 |
| Header / Channel | Web Phone 与 Native 左上角 Menu 打开左侧 Drawer；Web PC 继续用原 ChannelPC。Native Drawer 提供主会场、公共 Room、人数、成员 AVO 缩略图及加入。私密 Room 不返回。 |
| 移除顶部 Room 列表 | 删除 Native 顶部横条；抽屉点击与横滑使用同一 single-flight `move`，仍先确认退出并完成清理，再加入目标 Room。聚焦、全屏、弹层打开时不触发滑动换房。 |
| 图标 | Web SvgResource 原 SVG 提取至 `ui/meeting-icons`，两端共用。麦克风、摄像头、共享、离开及聚焦使用 Web LiveKit SVG，全屏与 Menu 使用原 Ant Design SVG。Native 经 react-native-svg 呈现。 |
| 首页 | Web `MeetingSection` 与 Native `ManualJoin` 消费 `spaceEntryContent`；同一 Logo、i18n，临时房间/房间名两 Tab。临时房间生成随机名称；输入名称或本服务链接则创建/加入。已有服务和链接校验保留。 |
| AVO | 目录返回明确投影的完整 AVO（name/variant/hue/style/energy/isUsed/enabled）和角色；按 Web 规则选中预设或回退首个。Web Creature 绘制引擎移动到 meeting-core，Web 仍用 p5，Native 用 SVG 绘图端口；HSB 转换、形态、变体与能量使用同一引擎。设置预览也使用该引擎，保存/删除预设不再重写剩余预设的 variant。 |
| 消息 Tab | TabBar 消息入口和渲染暂时注释，消息页源码保留；当前显示首页、会议、我的。 |

## 明确边界

- Native 首页 E2EE 和 Web 高清预设仍未实现，保留相同选项文案但禁用并说明；没有可勾选却不生效的假开关。普通创建/加入不受影响。
- Native 共享应用只读显示同 Room、已开启同步且在 Space 启用的待办/计时器/倒计时。目录排除私密 Room 的人、跨 Room 的应用和隐藏待办；不返回完整参与者实体、socketId、密钥。应用编辑、Web iframe/白板等不在本批实现内。
- Native 成员列表不新增踢人、改角色、移交主持人等管理 API；不能把列表 UI 对齐当作管理权限接通。
- Native Channel 已接浏览/加入，不新增创建、重命名、私密 Room 管理及反馈上传能力。缩略图是成员形象，不是新的 RTC 预览连接。
- AVO 共用绘制算法与参数；Native 未接 Web 的远端指针、抚摸/爱心交互。SVG 与 p5 的栅格化和随机噪声细节有平台差异，不承诺逐像素动画相同。隐藏面板、后台不继续绘制动画；预设和 Channel 缩略图为静态帧。
- 本次没有新增原生依赖。更新 API 后再测试完整 AVO/共享应用数据；旧 API 不含这些字段。JS export 不等于 iOS/Android 真机验收。

## 自动验证与待回归

已跑 Web、Mobile、共享 UI、API TypeScript，导入边界、195 项单元/组件测试和 169 项隔离后端测试；Web 在独立安装依赖的 `/tmp` 副本标准构建，Mobile 分别导出 iOS/Android JS。具体结果见 checklist 本批记录。

建议同时开一个 Web 和一个 Native：

1. 首页两 Tab、随机创建、具名/链接加入，输入焦点与中文键盘；创建后仍保留两个默认 Room。
2. Web PC 布局和设置不变；Web Phone 与 Native 左上角抽屉开关、主会场/Room 点击加入、横滑退出确认。
3. 成员姓名/头像颜色/房主/管理员标志及设备状态，搜索与分享。
4. Tile 聚焦/取消、摄像头和屏幕共享的全屏/返回、Android 返回键；操作控件不能触发换房。
5. Web 修改 AVO 的三种类型/颜色/变体，Native 刷新后对应；关闭 AVO；Native 加载/保存/删除预设后两端保持同一 variant。
6. 同 Room 的公开同步应用可查看；隐藏待办、未同步应用、跨 Room/私密 Room 数据不可见。
7. 切 Tab、后台、离开后的连接与动画清理；现有纵向 Space 预览/15 秒加入不受影响。
