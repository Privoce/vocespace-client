---
name: test-simple-page
description: Create a standalone mock test page under app/tests for a single component surface. Use when the user asks for 单页测试, a test page for a component, or mock data to render a component in isolation. Do not use for real integration, E2E, or unit tests.
---

# 单页测试（test-simple-page）

在本仓库为某个组件创建独立的 `/tests` 路由页面：用 mock 数据组装该组件的 Model，在真实 UI 树中渲染并交互，不依赖 LiveKit 连接、socket 和后端接口。

## 文件管理规则（先做）

- 路由页只能是 `app/tests/page.tsx`（**小写**，Next.js App Router 只识别小写文件名）
- `app/tests/` 下同一时间只有一个可路由测试页。改写前若已有旧测试，先把旧内容备份到 `app/tests/.<组件名>.tsx`（点前缀不会被路由识别，需要看时手动改名）
- 在文件头用 JSDoc 注释说明：页面用途、mock 范围、支持交互

## 处理步骤

1. **确定渲染入口**：找到组件的 Surface/分支入口（通常是 `components/Xxx/index.tsx` + `pc.tsx`/`phone.tsx`），确认导出名和 props（一般是 `{ model }`）。
2. **枚举 Model 字段**：Model 类型通常是 `ReturnType<typeof useXxx>`。读消费端组件（content/pc/phone），把解构的**所有**字段列出来 —— mock 时一个不漏；未被消费的字段靠最终 cast 兜底即可省略。
3. **读底层 hook**：搞清每个字段语义 —— 哪些是 state（用真实 `useState` 保留交互）、ref、纯 setter、异步 action、静态选项数组。
4. **写 mock 常量**：放在模块顶部，尽量用真实领域类型（`lib/std` 下的 `SpaceInfo`/`ReadableConf`/`ChatMsgItem` 等）标注，让 `tsc` 帮忙校验形状；能复用 `DEFAULT_*` 常量就复用。参与者的 `online`/`socketId`、消息时间跨度（>5 分钟触发分割线）等要覆盖组件内的分支渲染。
5. **页面组件内组装**：
   - 交互状态用真实 hook：`useState`/`useRef`/`Form.useForm`/`useI18n`/`theme.useToken`/`message.useMessage()`（记得渲染 `contextHolder`）。根布局已提供 `I18nProvider` + `ConfigProvider`，`useI18n` 可直接用
   - **所有触碰 API/socket 的 action 一律 mock**：`console.warn` 记录参数 + `messageApi` 提示，绝不发真实请求；建议封装 `const log = (action, ...args) => console.warn('[XxxTest] ...')`
   - 组装 model 对象，末尾 `as unknown as XxxModel`
6. **LiveKit 依赖检查**：grep 组件树是否有 livekit hooks（`useLocalParticipant`/`useRoomContext` 等）。
   - 有 → 用 `RoomContext.Provider` 包裹，value 用真实 `new Room()`（不连接是安全的）；`room.name` 是原型 getter，用 `Object.defineProperty(r, 'name', { value: ... })` 在实例上覆写
   - 参与者 Tile 用占位 track refs 即可渲染 Placeholder（无媒体流）：`{ participant: { identity, name } as unknown as RemoteParticipant, publication: undefined, source: 'camera' } as TrackReferenceOrPlaceholder`，默认关闭、用开关控制（假 participant 可能触发 hook 崩溃）
   - 无（如 ChatPanel，纯 props 传递）→ 不需要 RoomContext
7. **页面布局**：深色背景（`#141414`）工具栏 + 固定尺寸容器（如 320px 侧栏 / 300x560 面板）渲染目标组件；工具栏提供设备切换（pc/phone 走真实分支，如 Drawer）、常用弹窗快捷入口、重置按钮。
8. **验证**：`npx tsc --noEmit 2>&1 | grep <改动文件>` 确认无类型错误（项目中 `features/` 旧目录有存量错误，忽略）。
9. **汇报**：说明哪些是真实交互、哪些是 mock、控制台可预期的噪音（如组件静态引入 socket 模块导致的连接失败日志，不影响 UI 测试）。

## 已知坑

- **lib/api 循环引用 TDZ**：`lib/api(index)` ↔ `lib/std` 相互引用。若测试页依赖链中首个触达该簇的是子模块（如 `fs.tsx` 直接引 `@/lib/api/chat`），会报 `ReferenceError: Cannot access 'fetchLinkPreview' before initialization`。修复：在测试页**第一个 import** 写 `import '@/lib/api'` 并注释原因（`api` 在 std 中均为惰性使用，先初始化 index 即安全）。

## 项目约定

- 颜色用项目风格：面板 `#1e1e1e`/`#1a1a1a`、边框 `#2a2a2a`、主色 `#22CCEE`
- 已有测试页参考：`app/tests/.channel.tsx`（ChannelSurface）、chat 测试见 git 历史中的 `app/tests/page.tsx`
