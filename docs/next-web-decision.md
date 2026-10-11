# Web 框架取舍（2026-10-11）

结论：当前继续使用 Next 15.5.27；本轮不迁移 Vite，也不依赖 Next 承担业务后端。独立部署已经可以实现，框架迁移不应成为部署的前置条件。

## 当前代码依据

- 首页、new_space、动态 [spaceName]、dashboard 使用 App Router；页面和会中交互主要在客户端运行。
- 页面使用 next/navigation，重媒体模块使用 next/dynamic；layout 管理全局样式、Provider、metadata 和 viewport。
- app/api/* 仅转发独立 API，没有业务存储、鉴权实现或定时任务；HTTP 和 Socket 代理由 apps/web/server.js 提供。
- 当前未发现 Server Actions，也没有依赖 SSR 获取业务数据的主要页面。会议应用对 SEO/ISR 的依赖很小，Next 的服务端优势确实没有充分使用。
- Web 使用 SCSS、静态资源、RN Web alias、共享源码编译与 standalone 文件追踪。这些都有现成配置和回归基础。

## 判断

Next 的剩余价值主要是现有路由、页面组织、动态加载、构建和部署基础。独立 API 与继续使用 Next 不冲突；Next 官方也支持 SPA 模式及独立 Node/Docker 部署。

如果目标进一步变成“Web 必须纯静态托管，完全不运行 Node”，迁移 Vite + 客户端路由值得开展。那时需要替换路由/异步参数、dynamic、环境变量、共享 RN Web 构建映射和 metadata，配置深链接 fallback，并将 HTTP/Socket 代理交给网关。E2EE Worker、媒体 SDK、PC/Phone 样式和平台登录都要重新验收。

现在同时更换构建器，会扩大本轮目录和部署迁移的排查范围。建议先验证独立部署；后续若明确需要静态 CDN 托管或实测 Next 的构建/内存成本不可接受，再建立单独迁移批次。保持现有 UI 和会话控制器，不因换框架改版。

本轮新增 basePath 配置以让构建与代理前缀一致；生产 NEXT_PUBLIC_* 是构建输入，改前缀需要重建 Web 镜像。

## 参考

- [Next SPA guide](https://nextjs.org/docs/app/guides/single-page-applications)
- [Next self-hosting](https://nextjs.org/docs/app/guides/self-hosting)

参考用于说明框架能力；本仓库实现以锁定的 Next 15.5.27 和上述代码盘点为准，没有借此升级 Next。
