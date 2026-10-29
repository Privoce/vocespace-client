# VoceSpace 部署入口

当前 Ubuntu 部署使用源码构建 + PM2，Web 与 API 独立启动。请按 [Linux 部署指南](../linux_deploy.md) 使用 [环境准备](../scripts/ubuntu/setup.sh) 和 [构建 / 发布脚本](../scripts/ubuntu/deploy.sh)。脚本不修改 Caddy。

`deploy/shell/` 下的 Nginx 脚本是历史部署资料，不适用于当前流程。Docker 部署仍可参考 [独立部署说明](../docs/independent-deployment.md)；API 只能有一个实例写入持久化数据。
