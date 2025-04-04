export default {
  common: {
    confirm: '确认',
    cancel: '取消',
    alert: '提示',
    attention: '注意',
    warning: '警告',
    error: '错误',
    success: '成功',
    info: '信息',
    unknown: '未知',
    loading: '加载中...',
    no_data: '暂无数据',
    no_more: '没有更多了',
    demo: '演示',
    custom: '自定义',
    start_metting: '开始会议',
    join_room: '加入房间',
    passphrase: '密码',
    username: '用户名',
    device: {
      microphone: '麦克风',
      volume: '麦克风音量',
      test: {
        audio: '测试音频',
        close_audio: '关闭音频',
      },
      blur: '摄像头虚化',
      camera: '摄像头',
      screen: '屏幕',
    },
    chat: '聊天',
    leave: '离开',
    share_screen: '共享屏幕',
    stop_share: '停止共享',
  },
  msg: {
    info: {
      title: '由 Privoce 开发的基于 LiveKit 的自托管开源视频会议应用程序',
      contact: '请联系',
      learn_more: '了解更多',
      try_free: '通过我们的现场演示项目免费试用 Voce Space。',
      connect_with_server: '使用 Voce Space Server 将 Voce Space 与自定义服务器连接。',
      enabled_e2ee: '启用端到端加密',
      enter_room: '请输入房间号'
    },
    error: {
      e2ee: {
        unsupport: '您正在尝试加入加密会议，但您的浏览器不支持该功能。请将其更新至最新版本并重试。',
      },
      room: {
        unexpect: '遇到意外错误，请检查控制台日志了解详细信息。',
        network: '连接错误，请检查您的网络连接并重试。',
      },
      device: {
        in_use: '设备已被占用，请检查其他应用程序是否正在使用它。',
        not_found: '未找到设备，请检查设备是否连接并重试。',
        permission_denied: '权限访问被拒绝',
        permission_denied_desc: '未获得设备访问权限，请检查浏览器设置。',
        permission_denied_title: '设备访问权限被拒绝',
        other: '设备错误，请检查设备连接并重试。',
        granted: '权限被拒绝。请在浏览器设置中手动允许访问摄像头, 麦克风以及屏幕共享。',
      },
      other: {
        permission: '请求权限失败。',
      },
    },
    request: {
      device: {
        title: '设备访问权限',
        desc: '若您需要开启设备访问权限，请点击下方`允许授权`按钮。',
        allow: '允许授权',
        deny: '拒绝授权',
        waiting: '请求中...',
        ask: '需要访问您的摄像头和麦克风，请选择`允许`授权以继续使用。',
        permission: {
          how: '如何开启权限？',
          changed_with_reload: '权限更改后，您可能需要刷新页面才能生效。',
          set_on_hand: '如果您之前拒绝了权限，您可能需要在浏览器设置中手动允许它们。',
          chrome_edge: [
            '点击浏览器地址栏左侧的锁定图标',
            '选择`网站设置`',
            '在`摄像头`和`麦克风`下拉菜单中选择`允许`',
            '刷新页面',
          ],
          firefox: [
            '点击浏览器地址栏左侧的锁定图标',
            '点击`连接安全`',
            '选择`更多信息`',
            '在`权限`下拉菜单中选择`允许`',
            '刷新页面',
          ],
          safari: [
            '打开 Safari 偏好设置 (Safari菜单或右上角的齿轮图标)',
            '选择`网站`选项卡',
            '在`摄像头`和`麦克风`下拉菜单中选择`允许`',
            '刷新页面',
          ],
          other: '请查看浏览器帮助文档以获取更多信息。',
        },
      },
    },
    success: {
      device: {
        granted: '已成功授予媒体权限。',
      },
    },
  },
};
