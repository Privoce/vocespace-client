# 共享房间设置：保留 Web，提取 Phone 子面板与 i18n

> 2026-10-11：用户已授权恢复接口接入，创建、设置读写与录制数据的当前实现见 [Native 服务端接入](native-service-parity.md)。下文保留早期只读交付记录，不再表示当前接口范围。

2026-10-10 最新状态：用户反馈设置/图标「基本可以」；当前环境设置数据读取失败，用户同意暂缓联调。API/SDK/App 调用已经存在，不能将隔离测试通过表述为真实读取已通过。后续批次见 [后续实施计划](mobile-next-steps.md)。本次规划未关闭现有请求或更改接口。

2026-10-10 抽取范围：Web PC 与 Phone 已有外观保持不变，复用原 Phone 内容到 Native，包含内部组件、原图标与文案。此前被否定的通用设置表单重写已经撤回；本次使用原结构抽取，不恢复那套替代布局。

## 代码落点

| 内容 | 共享来源 | 平台适配 |
| --- | --- | --- |
| 个人卡片、目录与返回栏 | `packages/ui/src/meeting/PhoneSettingsNavigation.tsx` | Web 保留原 DOM/SCSS，App RN 部件 |
| 常规、AVO、权限、音频、视频、应用、AI、录制、证书、关于 | `packages/ui/src/meeting/settings/content.tsx` | Web 仅 Phone 分支调用；PC 保留原 JSX |
| AVO 编辑/预设、虚拟形象、AI 分析/部署表单、录制列表/卡片、证书更新/退订内容 | `packages/ui/src/meeting/settings/advanced.tsx` | 控件、媒体预览、上传和请求留在端内 |
| 中英俄词典、语言规范化与翻译 | `packages/i18n/src` | Web `lib/i18n/i18n.tsx`；Native `apps/mobile/src/i18n` |
| 15 个原 SVG，包括设置分类、语言、模型/背景等 | `packages/ui/src/settings-icons.ts` | Web SVG DOM；Native `react-native-svg` |
| 观众自己的偏好与权限表 | contracts/SDK `native.settings`，`services/api/native-settings.ts` | 已确认的 Native 会话，只读 |

Web `Settings/index.tsx`、PC Tabs、样式文件和媒体/表单状态所有者保持原状。Phone 使用同一份内容顺序、标签及布局，通过端口传入原 Ant Design 控件。布局函数不持有 Hook，直接返回原层级，避免为抽取增加一层组件导致输入/媒体重挂载。

Native 分类使用原词典的「设置」「常规」「AVO形象」「权限」「音频」「视频」「应用」「录制记录」「证书」「关于我们」。AI 沿用 Web 访客隐藏规则。语言、音频和视频选择框也使用原 SVG 前缀；方向/操作图标使用对应 Ant Design 图标。菜单不再使用「个人资料」「授权」等另写名称。

目录与详情切换复位滚动位置；已访问子面板保持挂载，返回不会丢弃本机预览草稿。换房取消旧请求并清理旧设置状态。语言选择立即更新设置文案，AsyncStorage 串行保存；迟到读取不会覆盖用户刚选的语言，保存失败会提示。

## Native 能力边界

| 范围 | 本次状态 |
| --- | --- |
| 目录、子面板排列、字段、颜色、标题/图标/文案、语言切换 | 接入共享 Phone 组件；最终像素与设备体验仍待回归 |
| 访客自身状态、音量/处理偏好、AVO 预设与虚拟形象偏好、应用权限、房间 RBAC 表 | 读取链路已实现且隔离测试通过；当前环境读取失败，联调暂缓；未知值不伪装成已关闭/已授权 |
| 获邀麦克风与摄像头 | 保留原授权流程，用户主动开启；设置页复用既有设备控制器 |
| AVO | 共享编辑与预设布局，读取自身已存预设；Native 当前为本机静态预览，未移植 Web p5 动画，也未接通预设保存/导入/导出 |
| 视频虚化、虚拟角色/背景 | 字段和相同的模型/背景缩略图已呈现；Native Live2D、模糊处理和媒体预览适配未完成 |
| 房间持久化/访客策略、资料写入、音频路由/处理、应用同步、AI 配置 | 当前访客 App 无相应写入适配；相应控件按实际权限隐藏或禁用，显示原因 |
| 录制列表/证书 | 共用布局、字段和弹窗内容；当前 App 没有读取文件/证书及管理订阅的授权，不显示假数据、不触发交易 |
| 关于页 | 原 Logo、完整介绍、联系邮箱和官网链接，打开失败有提示 |

**组件抽取完成不等于上述 Native 平台能力全部完成。** PC 与 Web Phone 的原有操作继续由原业务代码处理，本次未放宽访客权限、收集部署密钥或启用录制/订阅管理。

## 只读接口与安全边界

`POST /api/v1/native/settings` 仅接收 `joinId`。复用 Native 会话、已确认入房、撤销记录和受控无子房间试运行 Space 的验证，读取后再验证一次会话/成员。响应显式投影自身展示偏好与 RBAC 布尔值，不包含其他成员、AI 密钥、证书或存储凭证。其他方法返回 405；客户端传入 identity/room/role 不影响读取对象。

这不是新用户体系，也不是房间管理 API。SDK 使用部署前缀、Bearer 与取消信号，解析验证响应后才交给视图。失败不会改变任何配置。

## 验证

- 原目录/返回栏与冻结 Web 版本 DOM 对照；PC Tabs 与输入草稿保持。
- 九类内容在中英俄、房主/访客条件下与原 Web 分支对照；AVO Phone 和录制 Phone 与冻结原版完整标记对照。
- 15 个 SVG 在不同尺寸和颜色下逐个对照原路径、属性与 Logo 渐变。
- Native 语言恢复、切换、迟到读取、串行保存与失败提示；只读接口投影、越权、撤销与 SDK 行为。
- 最终 147 项测试（23 文件）、102 项后端集成检查通过；根/Native/UI 类型、边界、改动模块 lint、标准隔离 Web/API 构建和 iOS/Android Expo JS 导出通过。lint 保留既有警告。集成测试使用隔离 Redis/API 与模拟媒体服务，未连接用户 Redis。
- AVO 各预设保留独立预览草稿，迟到快照不覆盖编辑；重置不会误改其他预设。

DOM 对照和 Expo JS 导出不能证明 Native 像素一致或真实音视频通过；Web 和 App 仍需人工检查所有详情页、长文案、键盘、横竖屏、返回和滚动，以及实际邀请/撤销/断线。

2026-10-10 图标 `U` 问题排查：旧 iOS Pods 未包含 RNSVG，显示的是 RN `Unimplemented component` 占位提示。本次已安装 RNSVG 15.15.3，验证生成的原生注册表包含 SVG 组件，并完成 iOS Debug 模拟器构建（0 错误、2 警告）、安装及启动至 iPhone 16 Pro。构建时仅对该命令移除继承的 Windows `CC`/`CXX` 覆盖。随后用户反馈设置/图标「基本可以」；完整逐项及真机回归仍待完成。

## 后续恢复联调时的回归步骤（当前暂缓）

1. 重启 `pnpm dev:api`，使只读设置接口可用；重启 `pnpm dev:web` 以加载新增 workspace 包。
2. 本次按 Expo 55 内置清单新增 `react-native-svg@15.15.3`，必须重建 App development build：`pnpm --filter @vocespace/mobile ios`（Android 用 `android`）。仅 Reload / 重启 Metro 不会安装原生 SVG 模块。
3. 进入同一个 Space，对照 Web Phone 与 App 的目录、详情、相同语言；确认 Web PC 原有侧栏、控件和管理操作保持。
4. 验证语言切换/重启保存、API 未启动/无权/撤销、设置返回后草稿和滚动、麦克风/摄像头邀请与撤销。不要把只读说明当作管理功能已开放。
