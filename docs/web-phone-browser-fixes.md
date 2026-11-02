# Web Phone 浏览器问题（2026-11-02）

本次 Web Phone 指浏览器中的 Phone 布局，Native 仅同步英文聊天占位文字。

## 已修改

1. Prejoin：滚动容器从 `100vh` 改为优先 `100dvh`，内容从顶部排列，禁止直接子项被压缩，底部增加 `32px + safe-area-inset-bottom`。原先页面外层为 `100dvh` 且隐藏溢出，内层 `100vh` 会超出 Safari 工具栏上方的可见区域。
2. iPad 控制栏：宽度大于 767px 时使用 PC 分支。PC / 旧 Phone 始终显示原 LiveKit `TrackToggle` 共享按钮，移除额外的替代按钮；无 `getDisplayMedia` 或会议未允许发布时禁用，并通过 Tooltip 区分原因。浏览器尚未授权不会预先禁用按钮，点击后由原 LiveKit 流程请求浏览器授权；已在共享时保留停止入口。共享 Phone UI 仍使用原 `useTrackToggle` 媒体适配。没有按设备名称禁用，也没有新增浏览器采集能力。
3. 英文聊天占位文字：Web 和 Native 均为 `Send your message`。
4. Web Phone 聊天：旧聊天面板及共享会议聊天输入框采用 16px 字号，避免 iOS 聚焦小字号输入框时自动放大页面；保留用户手动缩放。
5. Web 分享：按钮改为 `Copy Space link`，中英俄提示对应更新。两个 Web 复制入口均复制 `https://vocespace.com/{编码后的 Space 名称}`，不带当前页面查询参数、片段或邀请说明。Native 的复制名称行为保持原样。

## RustDesk iframe 排查

2026-11-02 对 `https://rustdesk.com` 执行跟随重定向的 GET 请求，返回 HTTP 200：

```text
x-frame-options: SAMEORIGIN
content-security-policy: upgrade-insecure-requests
```

`SAMEORIGIN` 拒绝来自 `vocespace.com` 的跨源 iframe 嵌入。当前 VoceSpace iframe 没有 sandbox 属性；调整 iframe 的 `allow` 无法解除目标站响应头限制。可在独立标签页访问 RustDesk；如需嵌入，应使用由目标服务明确允许嵌入的地址。本次仅核实该首页，不推断全部 RustDesk 域名或自建实例的策略。

## 仍待定位和真机回归

- 用户后续确认使用 Safari，现象为「共享开始后系统弹窗一直停留，无法收起」，并提供 iPhone 15（暂按机型记录），iPad 系统版本不详。系统 Screen Sharing 弹窗不属于网页 DOM，网页没有关闭系统选择器的 API；本次没有真机复现，不能宣称已修复。下一步先确认点击弹窗外的模糊空白区域能否收起并继续共享；若仍无响应，需 iPhone 的 iOS 软件版本及独立采集页面对照结果。
- iOS 屏幕广播通常通过点击弹窗外区域返回应用，参考 [Switcher 官方说明](https://support.switcherstudio.com/article/463-screensharing-an-ios-screen)。这是排查步骤，不代表已证实用户遇到的是正常系统交互。
- iPad 共享入口已修正，但实际发起屏幕采集依赖设备上的 `navigator.mediaDevices.getDisplayMedia` 和会议授权。下述模拟器已确认缺少 API，不能宣称 iPad 真机屏幕共享已通过。
- Safari 地址栏展开/收起、滚动到 Prejoin 底部、键盘显示/收起、聊天发送后缩放以及剪贴板内容仍需真机回归。
- 标准 API 的行为参考 [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)；保留运行时能力检测，不依据旧版兼容表一概认定所有 iOS 都不支持。

## 模拟器实测（2026-11-02 23:34–23:35）

通过 Simulator 的 Safari 打开独立本机检测页面（`http://127.0.0.1:18743/`），显示以下只读表达式结果；没有调用采集 API，也没有请求或修改媒体权限。页面不含 VoceSpace SDK、房间权限或业务请求。

| 项目 | iPhone 16 Pro | iPad Pro 13-inch (M4) |
| --- | --- | --- |
| 系统 | iOS 18.3.1（UA / Safari 开发菜单） | iPadOS 18.3.1（Safari 开发菜单） |
| `isSecureContext` | `true` | `true` |
| `typeof navigator.mediaDevices.getDisplayMedia` | `undefined` | `undefined` |
| `typeof navigator.mediaDevices.getUserMedia` | `function` | `function` |
| `innerWidth` | 402 | 1032 |

结论：这两个模拟器缺少屏幕采集 API，因此不能通过授予会议发布权限让共享生效。旧 PC 分支隐藏按钮、旧 Phone 分支置灰按钮与该结果一致；未能从远程检查器读出会议权限，不将其表述为已验证授权正常。此结果不能解释另一台真机已弹出系统共享面板却无法收起的问题。

测试结束关闭本机 HTTP 服务及 iPad 检测标签页；iPad 返回原会议标签页，iPhone 返回原测试房间的预加入页。线上地址仍为旧部署，本地修改尚未部署。

## 自动验证

2026-11-03 最终调整：PC / 旧 Phone 统一使用原 LiveKit 共享按钮及原有样式，不再提供另一种提示按钮，Chat 的 `ToggleBtn` 恢复原样。LiveKit 2.8.1 的 `useTrackToggle` 会用 pending 状态覆盖传入的 disabled，因此通过原生 disabled fieldset 禁用不可用的共享入口，避免仅修改视觉但仍能触发采集；正常共享和停止仍由原按钮处理。

- 全项目、API、Mobile、共享 UI 类型检查通过。
- 边界检查通过；相关目录 lint 无错误，有已有 Hook 依赖警告。
- `pnpm test`：25 个文件、93 项测试通过。
- 前一批修改的 API 制品检查和标准 `pnpm build` 通过（API + Web standalone）；本次恢复原按钮执行类型、边界、目录 lint、93 项测试及 `git diff --check`，不在运行中的开发目录重复生产构建。以上不代表真机媒体回归。
