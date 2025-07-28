- [ ] VoceStream
  - [x] 合并dev_0.2.0
  - [x] 观众模式
    - [x] 50+ 人数
    - [x] 观众只能看
      - [x] 保留观众音频
      - [x] 去除观众视频
      - [x] 去除观众屏幕分享
      - Prejoin
        - [x] 去除视频
        - [x] 去除模糊度调节
      - Settings
        - [x] 设置视频设置Disabled
        - [x] 设置录制Disabled
        - [x] 设置General-状态Disabled
      - [x] 去除视频流只开放音频流和屏幕流
      - [x] 去除App
      - [x] 去除Space-room概念
        - [x] 侧边栏
      - [x] 处理发布订阅模式
      - [x] 处理layout为focusLayout
      - [x] 去除用户状态

- [x] hq参数去除 (默认hq)


- [x] 首页
  - [x] 教师和学生入口
    - [x] 教师
      - [x] 增加登陆令牌
    - [x] 学生
      - [x] 客制化URL
- [x] 房间
  - [x] 区分角色
    - 教师
      - [x] 屏幕共享
      - [x] 更多设置
      - [x] 参数调整
      - [x] 离开
    - [x] 学生
      - [x] 离开
    - [x] 调整订阅权限
  - [x] 实时显示客户端参数
    - [x] 帧数
    - [x] 分辨率
    - [x] 码率
- [x] Api
  - [x] 调整房间数据结构
    - [x] ownerId -> ownerIds
  - [x] 调整用户数据结构
    - [x] 增加role字段
  - [x] 去除转让主持人权限
  - [x] 调整不同角色加入时随机名称


http://localhost:3000/voce_stream?student=true&login=true


- [x] 学生端去除参数显示
- [x] 学生端增加配置调整重加载（非手动）
- [x] meeting.sg-event.com
- [x] 修改logo大小
- [x] 全屏
- [x] 证书下载页
- [x] 设置中增加编码 
- [ ] 视频锐化滤镜