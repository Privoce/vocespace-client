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
    demo: '临时房间',
    custom: '房间名',
    start_metting: '加入',
    join_room: '加入房间',
    passphrase: '密码',
    username: '用户名',
    setting: '设置',
    compare: '对比效果',
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
    chat_placeholder: '请输入消息',
    send: '发送',
    send_file_or: '是否发送文件？',
    leave: '离开',
    share_screen: '共享屏幕',
    stop_share: '停止共享',
    wave_msg: '向您发送了一条提醒!',
    full_user:
      '房间用户已经超出限制，无法加入，您可以加入其他房间或告知构建者升级证书获取更多用户名额。',
    open: '开启',
  },
  channel: {
    menu: {
      header: '',
      main: '空间',
      sub: '房间',
      create: '创建房间',
      join: '加入',
      setting: '设置',
      delete: '删除房间',
      leave: '离开房间',
      rename: "重命名",
      switch_privacy: "切换隐私性",
    },
    join: {
      success: '加入房间成功',
    },
    delete: {
      success: '删除房间成功',
      error: '删除房间失败，请稍后再试。',
      remain: "房间中仍有成员，无法删除，请先通知所有成员离开房间。",
    },
    create: {
      success: '房间创建成功',
      error: '房间创建失败，请稍后再试。',
      empty_name: '房间名称不能为空',
    },
    leave: {
      success: '离开房间，返回空间成功',
      error: '离开房间失败，请稍后再试。',
    },
    modal: {
      title: '创建房间',
      desc: [
        "创建房间后，您可以邀请其他参与者加入该房间。房间可以用于特定的讨论或活动。",
        "在房间中，空间依然可见，您可以随时返回空间进行交流。对于空间的参与者，他们无法听到房间的讨论内容，但可以看到房间的存在。"
      ],
      placeholder: '请输入房间名称',
      cancel: "取消",
      ok: "创建房间",
      privacy: {
        title: "隐私性",
        public: {
          title:"公开",
          desc: "公开房间，任何在空间中的参与者都可以自由加入，房间权限宽松，适合开放讨论。"
        },
        private: {
          title: "私有",
          desc: "私有房间，房间权限完全被拥有者控制，只有经过房间拥有者的同意才能加入，适用于需要隐私保护的讨论。"
        }
      }
    }
  },
  more: {
    title: '更多',
    channel: "频道",
    record: {
      start: '录制',
      stop: '停止录制',
      title: '录制房间',
      desc: 'VoceSpace 将会录制房间中的音频和视频。请注意，录制可能会影响性能。录制结束后，您将收到一条通知，包含录制文件的下载链接。',
      request:
        "由于您不是房间主持人，您无法直接进行录制，若您需要录制，请点击'请求录制'按钮，房间支持人将收到您的请求，若同意将会开启录制。",
      confirm: '开始录制',
      confirm_request: '请求录制',
      cancel: '取消',
      download_msg: '录制已完成，正在传输至云端进行存储，您可以访问当前服务的records进行下载。',
      download: '下载录制文件',
      to_donwload: "前往下载"
    },
    participant: {
      title: '成员',
      manage: '管理成员',
      search: '搜索成员',
      manager: '主持人',
      invite: {
        title: '邀请成员',
        web: '浏览器中',
        add: '加入 VoceSpace 房间',
        texts: ['邀请您加入 VoceSpace', '请 点击|复制 以下链接到', '请复制以下房间名称到'],
        ok: '复制邀请',
        cancel: '取消',
        link: '链接',
        room: '房间名称',
      },
      set: {
        invite: {
          title: '成员邀请',
          video: '邀请开启视频',
          wave: '发送一条提醒',
          audio: '邀请开启音频',
          share: '邀请共享屏幕',
        },
        control: {
          title: '成员控制',
          trans: '转让房间主持人',
          change_name: '修改名称',
          mute: {
            audio: '静音音频',
            video: '关闭视频',
          },
          volume: '音量调节',
          blur: {
            video: '视频虚化',
            screen: '屏幕虚化',
          },
        },
        safe: {
          title: '安全',
          remove: {
            title: '移除成员',
            desc: '您确定要移除该成员吗？',
            confirm: '确定移除',
            cancel: '取消',
          },
        },
      },
    },
  },
  settings: {
    title: '设置',
    general: {
      title: '常规',
      username: '用户名',
      lang: '语言',
      status: {
        title: '状态',
        online: '在线',
        online_desc: '在线，用户的视频和音频都将正常工作',
        leisure: '休闲',
        leisure_desc: '休闲，用户的视频将进行模糊处理, 音频不做调整',
        busy: '忙碌',
        busy_desc: '忙碌中，用户的视频将进行模糊处理, 音频将静音',
        offline: '离开',
        offline_desc: '离开, 用户的视频和音频都将关闭',
        define: {
          title: '自定义状态',
          name: '状态名称',
          desc: '状态描述',
          icon: '状态图标',
          placeholder: {
            name: '请输入状态名称',
            desc: '请输入状态描述',
          },
          save: '保存状态',
          success: '创建新状态成功',
          fail: '创建新状态失败',
        },
      },
    },
    license: {
      title: '证书',
      signed: '是否已签名',
      domains: '允许的域名',
      limit: '证书限制',
      created_at: '创建时间',
      expires_at: '过期时间',
      value: '证书值',
      renew: '续订/更新证书',
      update: '手动更新',
      input: '请输入证书',
      gift: {
        title: '一个获取免费升级的机会！ 🎁',
        desc: '通过 blog 文章或社交媒体分享使用体验，获取免费升级的机会加微信获得：Privoce',
      },
      license_pro: 'VoceSpace 专业版 [$499/年]',
      license_custom: 'VoceSpace 定制版',
      price_select: '请选择价格套餐',
      meeting: '订阅会议',
      buy: '购买证书',
      invalid: '证书无效或已过期，请检查证书是否正确。',
      update_success: '证书更新成功',
      circle_ip:
        '当前您的IP地址为回环地址/私有地址，不建议您为此地址购买证书。请使用公网IP地址购买证书。若需要为私有地址购买证书并支持服务，请联系Wechat: Privoce。',
      confirm_ip: '请确认您的IP地址是否正确！',
    },
    audio: {
      title: '音频',
      volume: '音量',
      device: '音频设备',
    },
    video: {
      title: '视频',
      video_blur: '视频虚化',
      screen_blur: '屏幕虚化',
      device: '视频设备',
    },
    virtual: {
      title: '虚拟形象',
      tab: {
        model: '模型',
        background: '背景',
      },
      open: '开启虚拟形象',
      model: '虚拟形象模型',
      background: '虚拟形象背景',
      none: '无',
      none_warning: '请先选择虚拟形象模型再进行对比',
    },
    about_us: {
      title: '关于我们',
      brief: '在您的域名和品牌下进行安全的视频通话',
      desc: '我们将帮助您在您的子域下托管您自己的安全视频和音频会议平台，并使用您自己的徽标和品牌。使用企业级加密完全控制您的数据。',
    },
    device: {
      audio: {
        title: '音频设备',
        desc: '选择您的音频输入和输出设备。',
      },
      video: {
        title: '视频设备',
        desc: '选择您的视频输入设备。',
      },
      screen: {
        title: '屏幕共享',
        desc: '选择要共享的屏幕或窗口。',
      },
    },
  },
  msg: {
    info: {
      title: '由 Privoce 开发的您的网络共享工作空间',
      contact: '请联系',
      learn_more: '了解更多',
      offical_web: '官方网站',
      try_free: '创建一次性的新 VoceSpace。',
      try_enter_room: '输入您的 VoceSpace 名称或链接以加入或创建。',
      connect_with_server: '使用 Voce Space Server 将 Voce Space 与自定义服务器连接。',
      enabled_e2ee: '启用端到端加密',
      enter_room: '请输入房间名或链接',
      virtual_loading: '虚拟形象加载中...',
      invite_device: '邀请您开启:',
      remove_participant: '您已被房间主持人移除房间',
      req_record: '请求进行录制',
      recording: "房间在10s后将开启录制，若您不希望被录制，可点击'离开房间'按钮退出。",
    },
    error: {
      record: {
        copy: '录制链接复制失败',
        email: {
          empty: '邮箱地址不能为空',
        },
      },
      virtual: {
        video_stream: '虚拟摄像头流构建错误',
        model: '模型或视频不可用',
      },
      e2ee: {
        unsupport: '您正在尝试加入加密会议，但您的浏览器不支持该功能。请将其更新至最新版本并重试。',
      },
      room: {
        unexpect: '遇到意外错误，请检查控制台日志了解详细信息。',
        network: '连接错误，请检查您的网络连接并重试。',
        invalid: '房间不存在，请检查房间名称或链接。',
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
      user: {
        username: {
          change: '用户名修改失败',
          request: '请求用户名失败',
        },
      },
      file: {
        upload: '文件上传失败',
        download: '文件下载失败',
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
      user: {
        name: '正在为您请求可用的用户名...',
      },
    },
    success: {
      record: {
        start: '房间已经成功开启录制',
        stop: '房间录制已成功停止, 10s后录制状态将移除',
        copy: '录制链接已复制到剪贴板',
      },
      device: {
        granted: '已成功授予媒体权限。',
        mute: {
          audio: '音频-麦克风设备已静音',
          video: '视频-摄像头设备已关闭',
        },
      },
      user: {
        username: {
          change: '用户名修改成功',
        },
        lang: '语言修改成功',
        transfer: '您已成功被转让为房间主持人',
      },
    },
  },
};
