# 2026-10-20 Phone 会议界面重设计

本次范围为 Native App 和 Web Phone，按用户提供的八张截图调整，共用 `packages/ui/src/meeting`。Web PC 保留原设置、成员管理与会议分支；连接、权限、媒体采集与 API 仍由两端原适配器负责。

## 已实现

- 统一底部弹层：遮罩、圆角、拖拽提示条、标题、副标题、返回和关闭。提示条是视觉元素，当前支持关闭按钮/点击遮罩，未新增拖动关闭手势。
- 更多：举手、分享 Space 两张卡片，成员、应用、设置等操作列表；已有录制、平台入口仍按 Web 原权限规则显示。
- 分享：Space 名称、复制操作，Web 原邀请链接能力保留。复制不创建新会话。
- 成员：首字母头像、本人/房主/管理员/说话状态、麦克风状态与分享入口；人数较少时缩短弹层。Web 原成员管理操作菜单保留在管理入口。
- 设置：个人信息卡、空间与偏好、设备与应用、更多分组；常规和权限采用共享卡片结构。语言、状态、提示音、持久化、访客策略及原 RBAC 管理沿用原接口。权限页设备开关遵守 RTC 发布权限，只有主动点击才请求采集，不根据截图开放额外权限。
- 会中：主 Tile、紧凑成员栏、内嵌聊天/成员页签和展开聊天、聚焦/全屏/应用操作、五项底部控制。聊天关闭或切换页签保留草稿；发送失败行为沿用原模型。
- 头像改为首字母展示，不新增 AVO 资源；设置里的原 AVO 编辑能力继续保留。
- App 正式加入、连接中和退出清理期间隐藏底部 TabBar；预览列表保留 TabBar，退出完成后恢复导航。
- 新文案加入中英俄共用词典，主色保持 `#22CCEE`。

## 结构与兼容

共享新增 `MeetingSheet`、`MeetingDock`、`MeetingShare`、`MeetingTileActions`、`InitialAvatar`，两端只注入控件与动作。Web `PhoneSheet` 负责 DOM portal、焦点恢复、Tab 焦点范围和 Escape 关闭，PC 不套用这层样式。Web Phone 默认使用共享会议视图，不再依赖 `meetingUi=shared` 参数。

Native 隐藏但保留挂载的列表使用透明、脱离正常排版并屏蔽交互/无障碍的方式。模拟器复现过在 `display:none` 的 ScrollView 更新数据时触发 Yoga 断言；调整后，状态更新和面板切换验证通过。复杂操作卡片用 RN Pressable，普通按钮、输入和开关继续使用现有 Ant Design Native 适配。

## 验证与入口

- 全量 Vitest：42 个测试文件、206 项通过，包括草稿保留、展开/收起、禁用动作、设备授权拒绝及成功后才保存偏好。
- 根 TypeScript、Mobile TypeScript、UI TypeScript、依赖边界与空白检查通过。
- 相关 Web lint 无错误，旧模块仍有既有 Hook 依赖警告。
- iOS、Android Expo JS 导出通过；没有因此声明原生编译或真机采集通过。
- Web 390 × 844 视口及 iOS 模拟器验证共享界面；模拟器已检查更多→设置→常规/权限、成员→分享、聊天展开/关闭与草稿保留。

无服务视觉验证入口：Web `/labs/meeting-ui`；Native 可在独立开发终端临时设置 `EXPO_PUBLIC_MEETING_UI_PREVIEW=1` 后启动 Metro。Native 开关仅在 `__DEV__` 生效，页面明确标为静态验证，不调用账号、API、RTC 或设备采集。普通启动不设置此变量即进入正常 App。不要把此演示数据作为正式会议数据验收。

## 待用户回归

真实会议下验证两端聊天发送/附件、成员管理与举手、设置写入、聚焦/全屏/应用、Channel、重连和退出；确认 App 退出后 TabBar 恢复。真机验证软键盘、安全区、屏幕旋转、音视频与屏幕共享。Web PC 仍需一次外观/交互回归，本次自动对照测试不替代用户验收。

## 2026-10-20 晚间修正：会议 Tile 的 AVO

用户进一步明确：首字母头像仅用于成员/聊天等列表，会议 Tile 仍按原 AVO 行为展示。Web Phone 重新接入现有 ParticipantAvoPlaceholder，使用与原 Web Tile 相同的本机/远端已选 AVO 配置；Native 重新接入 MeetingAvo，使用目录下发的配置。视频轨道仍优先显示视频；AVO 关闭时 Web 使用 ParticipantPlaceholder，Native 复用该组件的 SVG 路径。全屏和紧凑 Tile 同步，列表首字母头像保持不变。

自己的摄像头 Tile 工具栏补回“形象”，点击打开设置的 profile / AVO 页面；不提供修改其他成员形象的入口。共用图标与中英俄文案已同步。

验证：206 项测试、根/Mobile/UI 类型、边界、相关 Web lint、iOS/Android JS 导出及空白检查通过。本次未重复连接真实 RTC 或执行模拟器视觉验收；待用户验证 AVO 开关、预设保存后的两端同步、全屏及“形象”跳转。

## 2026-10-20：Tile 交互、举手与退出导航修正

- Mobile / Web Phone 移除 Tile 外层的放大点击区域，让 AVO 接收交互。Web 使用原 ParticipantAvoPlaceholder 的 interactive 模式，Native 点击调用同一 Creature.pop 动画；放大仅由工具按钮触发，紧凑成员卡片也保留独立放大按钮。
- 房主标记使用已有 SvgResource 的 host 资源、颜色 #FFAA33；Tile 工具和底部控制栏隐藏可见文字，保留按钮的无障碍标签。PC 分支未修改。
- 举手反馈改为临时 Ant 提醒，不再占据主画面上方。共享 Tile 左上角根据成员 raiseHand 状态显示图标；本人可点击放下，更多菜单也可切换举手/放下。Native Socket 验证当前已确认会话，只更新本人状态，使用 CAS 保留并发更新和 JSON 数组；放下仅广播状态刷新，不重复通知主持人。目录 DTO 新字段为可选布尔值，兼容旧响应；举手不授予媒体权限。
- TabBar 原因是 Ant WithTheme 保留已合并样式，省略 display 属性无法撤销先前的 none。退出清理完成后显式恢复 flex，不重新挂载 TabBar 或会议连接所有者。

验证：212 项单元/组件测试、187 项隔离 HTTP/Redis/Socket 检查、根/API/Mobile/UI 类型、边界、iOS/Android JS 导出和 diff 空白检查通过。相关 Web lint 无错误，原有 Controller hooks 依赖警告仍在。本轮未连接真实 RTC、操作模拟器或真机；待回归 AVO 点击、放大/全屏、跨端举手/放下与退出后 TabBar 恢复。更新后需重启 API 并重新加载客户端。
