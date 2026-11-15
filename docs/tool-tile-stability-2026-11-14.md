# 工具 Tile 稳定性与 Cobrowse 命名（2026-11-14）

用户反馈线上 iframe / 共享浏览器 Tile 同时消失，数秒后恢复，普通参与者 Tile 正常。

代码确认的失效路径：

- `useConferenceMembership` 原先仅在 RTC Connected 时返回 selfRoom。进入 Reconnecting 后 selfRoom 变空，列表 effect 清空工具，布局过滤全部工具 Tile；重连结束重新拉取，播放器因此卸载重建。现保留重连期间的所属房间，真正断开/换房仍清空。
- Web 接收缺失 players 的响应时原先当作空列表；设置响应缺失 children 时也会让工具布局消失。现拒绝无效结构并保留上次有效状态。
- 工具清单原先直接覆盖 JSON，读取/解析失败返回成功的空列表。现写临时文件再原子 rename，仅 ENOENT 表示首次空列表，读取/解析异常返回 503，客户端保留已有列表。

Hyperbeam SDK 重连回调只操作共享浏览器内部，没有删除其他 iframe Tile 的路径。因此它本身不能解释全部工具消失；尚未取得线上故障时的连接状态和请求日志，不能宣称已确认线上唯一根因。

显示名称在 Web、Mobile、Labs 与配置词典中改为 Cobrowse；SDK 包名、协议 mode、API 动作和已有配置键保留，兼容已存储数据。

验证：重连保持列表、畸形响应保持列表、真正换房清空的 Hook 回归；临时目录验证缺失/损坏 JSON 与并发读取原子写入。全项目/API/Mobile 类型、依赖边界、API 构建通过；相关 lint 无错误，保留原有 Hook 警告。全量测试 177 项通过。未部署，线上持续运行回归待 Web/API 更新后完成。
