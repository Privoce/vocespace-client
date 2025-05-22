- [x] 服务器落地页更新脚本
- [x] 用户状态使用用户id隔离 (服务器)
- [x] wave hand该用服务器通信
- [x] select 组件hover效果
- [x] 虚拟形象去除开始启动

- [x] 用户名改为 User [01~99]
- [x] 用户状态通过服务器同步
- [x] 虚拟视频使用用户id隔离


- [x] 虚拟形象页面UI优化
- [x] 虚拟形象丢失（重更新后消失）

- [x] 屏幕分享时传输其他用户鼠标位置
- [x] 区分用户显示虚拟形象
- [x] 同步修改用户视频模糊
- [x] 同步修改用户屏幕分享模糊度

- [x] focus视图无需点击就能传输用户鼠标位置
- [x] 让所有人共享鼠标位置视图
- [x] 开启虚拟形象之后其他用户会变黑
- [x] 开启按钮改为model - none

- [x] 鼠标位置同步(cover content获取video组件的宽高进行映射比例)
- [x] wave 双方都要发出声音提示
- [x] 设置页，点击外部遮罩关闭
- [x] 声音改为用户输入声音音量
- [x] 进入房间i18n修改

- [x] 鼠标离开去除
- [x] 默认prejoin页面聚焦用户名输入框
- [x] 虚拟形象层级低于触发层
- [x] 用户状态处理
- [x] PreJoin骨架屏
- [x] tradition，去除Screen Share模糊度
- [x] 用户鼠标颜色
- [x] 多个人开启虚拟形象之后，上一个人的会消失

- [x] 用户状态同步失败
- [x] 鼠标移除，用户10s超时移除
- [x] 设置音量绑定失效
- [x] 退出设置后关闭视频获取
- [x] 限制虚拟形象对比
- [x] 本地模糊 (webGL)

- [x] css虚化
- [x] 虚拟形象暂停追踪(该用动画)
- [x] 服务器room数据接口 http://localhost:3000/chat/api/room-settings?all="true"
- [x] 搜索时www.会加上 (在DNS设置中，添加一个CNAME记录，将www.vocespace.com指向vocespace.com)

--- 0.1.4

- [x] 客户端性能检测
- [x] 服务端性能检测
- [x] 聊天传输文件
  - [x] 重写Chat组件
  - [x] socket传输

- [x] 离开按钮移动到最右边
- [x] 状态图标没有正确修改 (设置时正常的，状态没有同步)
- [x] 虚拟形象是否可以去除视频 (实际是不行的，因为虚拟视频的流替换需要原始视频流持续流入)
- [x] 名字修改后没有同步到组件上
- [x] 测试服务器瓶颈

--- 

- [x] 切换布局或开启摄像头时有一瞬间清晰 ❗️
- [x] Blur布局切换时异常 ❗️
- [x] 模型在切换背景后消失 ❗️
- [x] 虚拟形象设置和视频合并 ❗️
- [x] 房间区分
- [x] API用户下线清理
- [x] 完善chat-file

- [x] 屏幕分享其他人首次加载事件很长
由于布局进行切换，通道会进行重新订阅，元素会进行重新加载因此会导致加载延时
- [x] Screen增加video相同滤镜切换效果

- [x] 重新增加虚拟形象切换时的遮罩
- [x] 更换压缩率较低的编解码器
- [x] 调整chat时图片大小 = 文件大小
- [x] 用户自定义状态，提供其他用户被选，其他用户只有可读，不可写 (socket)
- [ ] 根据状态区分不同的room （同一状态能看到对方）(tandem)
- [ ] 录屏 https://docs.livekit.io/home/egress/outputs/#supported-outputs
- [ ] 少参与者，多观察者 (Egress 实时传输，站点构建)
- [x] tradition环境进行速度缓慢
- [x] video blur 预览
- [x] 编辑用户名字图标，位置调整
- [x] 按钮外边距调整

- [x] chat输入部分ui调整（b站）
- [x] 新用户新状态同步
- [x] 持续遮罩当切换虚拟形象时
- [x] 虚拟形象移除对比，保留None时blur的对比
- [x] 首页骨架屏
- [ ] 用户自定义虚拟形象: 用户提交虚拟形象图片 -> live2d cubism 自动处理 (代码尝试) -> 生成完整动画效果 + 模型数据 -> 存储 -> 返回
- [x] 重连机制 -> webrtc turn
- [x] 禁止输入框enter事件
- [x] 状态点击事件

- [x] 首页骨架屏调整为400ms, logo png -> insert svg
- [x] 回车直接发送消息 (Chrome)
- [x] 开启后重新加载虚拟形象(setting)
- [x] 虚拟形象替换时，使用遮罩
- [x] focus布局时点击状态修改事件丢失
- [x] Turn 测试 https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ （测试成功）
- [x] 进入link regex  (特殊字符)

Time 	Type 	Foundation 	Protocol 	Address 	Port 	Priority 	URL (if present) 	relayProtocol (if present)
0.001	host	0	udp	192.168.31.211	52248	126 | 32512 | 255		
0.001	host	3	tcp	192.168.31.211	9	125 | 32704 | 255		
0.002	host	0	udp	192.168.31.211	57546	126 | 32512 | 254		
0.002	host	3	tcp	192.168.31.211	9	125 | 32704 | 254		
0.658	srflx	1	udp	101.83.176.123	57546	100 | 32543 | 254		
0.658	relay	2	udp	158.247.198.2	53072	5 | 32543 | 254		
0.886	Done


- [x] Docker部署
- [ ] 视频流从setting和tile之间切换
- [x] 视频加载两次（prejoin）video track
- [ ] Caddy 
- [x] 自定义错误页面
- [ ] 视频教程
- [ ] 部署测试基础版本
- [x] license服务
- [x] chat增加link跳转 ->hover 之后
- [ ] 文件拖拽发送

- [x] docker - 无虚化 （tradition）
- [x] 时间戳转正常时间
