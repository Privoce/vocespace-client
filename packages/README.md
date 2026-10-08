# 共享 Workspace 包

contracts、domain、client-sdk、server-core 已有独立 package.json，通过 workspace:* 声明依赖。当前使用 TypeScript 源码 exports，由消费者编译，不发布 npm。Web 和 Native 共享协议/SDK，不共享页面、Hook 或媒体实例。

依赖边界由 pnpm check:boundaries 检查。旧根 lib 仍有待拆分的兼容实现，不允许 Native 引用。详见 [迁移说明](../docs/monorepo-first-batch.md)。
