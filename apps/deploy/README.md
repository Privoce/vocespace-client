# @vocespace/deploy

VoceSpace 的独立 Web / Server 发布工作台，默认端口 **4848**。

```bash
pnpm build:deploy
pnpm start:deploy --root /var/vocespace/main
```

使用 `ROOT/api-data/vocespace.conf.json` 中的 `hostToken` 登录。创建与更新发布必须选择 GitHub 分支，任务会先 fetch，再 reset --hard 到对应 origin 分支并构建上线；回滚和清理版本保持独立流程；日志持久保存。生产发布使用 Ubuntu 上与业务服务相同的 PM2 用户。

启动、PM2 常驻、配置与验收范围见 [部署说明](../../docs/deploy-platform.md)。
