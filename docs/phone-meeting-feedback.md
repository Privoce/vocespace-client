# 2026-10-22 Phone / Mobile 布局、Channel 与反馈

## 本次实现

- 共享 `usePhoneMeeting` / `PhoneMeeting` 固定多人 Grid 两行；两人占上方两格，Focus 的单张副卡仍为半宽。分页、媒体挂载与聚焦入口保持原逻辑。
- `MeetingTileView` 名称、状态绝对定位覆盖媒体；媒体仅预留 38px 工具栏，不再为信息行留空。紧凑副卡媒体铺满。
- Native Channel 复用现有连接中可用的摄像头轨道；无视频时播放既有 MeetingAvo，关闭形象时居中显示 ParticipantPlaceholder。抽屉隐藏时移除视频视图并停止动画更新，不新增 RTC 连接或私密房间订阅。加入按钮使用常规 Ant Native ghost 按钮。
- 更多面板箭头统一为 16px；设置上方增加问题反馈。
- `packages/ui/src/meeting/FeedbackForm.tsx` 统一 Mobile / Web Phone 的邮箱、类型、正文、附件和提交状态；浏览器选择文件和 Native document picker 分别适配，沿用现有反馈邮件/上传处理器。失败保留草稿与已上传附件，忙碌期间避免重复发送。
- Mobile 直接使用已登录账号邮箱；Web Phone 通过当前服务端已验证的平台身份查询 Supabase 邮箱，不信任客户端提交的用户 ID。游客仍填写联系邮箱。PC 保留原反馈界面。

## 服务与依赖

- `POST /api/v1/native/feedback` 使用现有 Native Bearer 会话，拒绝浏览器 Origin，支持 JSON / multipart，按会话限制每分钟 10 次上传或提交。没有放开 Native 访问 legacy 路由。
- `GET /api/v1/feedback/account` 只读取当前浏览器会话对应的平台账号邮箱；没有已验证平台身份时返回空。服务端沿用 Supabase URL / service role 配置。
- 实际投递沿用已有 SMTP 配置和收件人，文件沿用 `uploads/feedback`。本次未发送真实邮件或上传用户文件。
- 新增 `expo-document-picker@55.0.17`。安装依赖后需要重建 development build，仅更新 JS 不足以启用原生文件选择。API 新路由需重启 API 后生效，本次没有重启用户服务。

## 验证与待回归

已通过：248 项单元/组件测试、187 项隔离后端检查、根/API/Mobile/UI 类型检查、共享包边界、相关 lint、独立副本标准 API/Web 生产构建、部署检查、iOS/Android JS 导出、差异空白检查。构建保留原有 Hook / img 警告，未关闭检查。

浏览器静态预览以 390×844 检查两人 Grid / Focus、更多菜单和反馈表单。静态预览不连接 RTC、不采集媒体、不发送邮件；它只证明共用布局与交互呈现。

待真机 / 真实服务回归：Channel 摄像头切换及占位、AVO 动画、抽屉反复开关、软键盘与文件选择、登录邮箱、附件上传及邮件投递。JS 导出和模拟接口测试不等于上述能力验收。

## ExpoDocumentPicker 缺失修复

旧 development build 不包含新增原生模块时，静态导入会在启动阶段抛错。现改为先用 Expo 的可选原生模块检查，再在点击附件时加载 picker；缺失时显示重建提示，保留正文并允许继续发送纯文字反馈。

本机已执行 `pod install`，确认 Podfile.lock 中包含 ExpoDocumentPicker 55.0.17，ExpoModulesProvider 已注册 DocumentPickerModule。仍须重新编译安装到使用中的设备；Metro 热更新不能补装原生模块。根/Mobile/UI 类型、6 项专项测试、边界检查和 iOS JS 导出通过。

原生验证补充：使用 Apple clang 的 arm64 iOS Simulator Debug 构建通过，包含 DocumentPicker 模块；未安装至用户设备，未验证文件选择器实际交互。初次命令受 shell 的 Windows 交叉编译器设置影响，重试仅在该构建命令内指定 clang，未更改全局配置。
