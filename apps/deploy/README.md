# @vocespace/deploy

VoceSpace 的独立 Web / Server 发布工作台，默认端口 **4848**。

```bash
pnpm build:deploy
pnpm start:deploy --root /var/vocespace/main
```

使用 `ROOT/api-data/vocespace.conf.json` 中的 `hostToken` 登录。创建发布、拉取更新、回滚和清理版本均通过内置任务执行器完成；日志持久保存。生产发布使用 Ubuntu 上与业务服务相同的 PM2 用户。

启动、PM2 常驻、配置与验收范围见 [部署说明](../../docs/deploy-platform.md)。
