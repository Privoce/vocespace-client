export default {
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    alert: 'Alert',
    attention: 'Attention',
    warning: 'Warning',
    error: 'Error',
    success: 'Success',
    info: 'Information',
    unknown: 'Unknown',
    loading: 'Loading...',
    no_data: 'No data available',
    no_more: 'No more data',
    demo: 'New Space',
    custom: 'Enter Space Name',
    start_metting: 'Join',
    join_room: 'Join Room',
    passphrase: 'Password',
    username: 'Username',
    setting: 'Setting',
    compare: 'Compare Effect',
    device: {
      microphone: 'Microphone',
      volume: 'Microphone Volume',
      test: {
        audio: 'Test Audio',
        close_audio: 'Close Audio Test',
      },
      blur: 'Camera Blur',
      camera: 'Camera',
      screen: 'Screen',
    },
    chat: 'Chat',
    leave: 'Leave',
    share_screen: 'Share Screen',
    stop_share: 'Stop Share Share',
    wave_msg: 'sent you a reminder!',
  },
  settings: {
    title: 'Settings',
    general: {
      title: 'General',
      username: 'Username',
      lang: 'Language',
      status: {
        title: 'Status',
        online: 'Online',
        online_desc: 'Online, user can receive any messages',
        idot: 'Offline',
        idot_desc: 'Offline, user will not receive any messages',
        busy: 'Busy',
        busy_desc:
          'Busy, do not disturb, user will not receive any messages but still appears online',
        invisible: 'Invisible',
        invisible_desc: 'Invisible, user will not appear online but can use all Vocespace features',
      },
    },
    audio: {
      title: 'Audio',
      volume: 'Volume',
      device: 'Audio Device',
    },
    video: {
      title: 'Video',
      video_blur: 'Video Blur',
      screen_blur: 'Screen Blur',
      device: 'Video Device',
    },
    virtual: {
      title: 'Virtual Role',
      tab: {
        model: "Model",
        background: "Background",
      },
      open: 'Enable Virtual Role',
      model: "Virtual Role Model",
      background: "Virtual Role Background",
      none: "None"
    },
    about_us: {
      title: 'About Us',
      brief: 'Secure Video Calls Under Your Domain and Brand',
      desc: 'We will help you host your own secure video and audio conferencing platform under your subdomain with your own logo and branding. Complete control over your data with enterprise-grade encryption.',
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
      title:
        'Your cyber co-working space developed by Privoce',
      contact: 'Contact',
      learn_more: 'Learn More',
      try_free: 'Create a one-time new VoceSpace.',
      try_enter_room: 'Enter your VoceSpace name or link to join or create.',
      connect_with_server: 'Connect Voce Space with a custom server using Voce Space Server.',
      enabled_e2ee: 'End-to-end encryption enabled',
      enter_room: 'Please enter the space name or link',
      virtual_loading: 'Loading virtual role, please wait...',
    },
    error: {
      virtual: {
        video_stream: 'Virtual camera stream construction error',
        model: 'Model or video unavailable',
      },
      e2ee: {
        unsupport:
          'You are trying to join an encrypted meeting, but your browser does not support this feature. Please update it to the latest version and try again.',
      },
      room: {
        unexpect:
          'An unexpected error has occurred. Please check the console logs for more details.',
        network: 'Connection error. Please check your network connection and try again.',
        invalid: 'Room does not exist. Please check the room name or link.',
      },
      device: {
        in_use: 'The device is currently in use. Please check if other applications are using it.',
        not_found: 'Device not found. Please check if the device is connected and try again.',
        permission_denied: 'Permission access denied',
        permission_denied_desc:
          'Access to the device was not granted. Please check your browser settings.',
        permission_denied_title: 'Device access permission denied',
        other: 'Device error. Please check the device connection and try again.',
        granted:
          'Permission was denied. Please manually allow access to the camera, microphone, and screen sharing in your browser settings.',
      },
      other: {
        permission: 'Failed to request permission.',
      },
      user: {
        username: {
          change: 'Username changed failed',
          request: "Failed to request username",
        },
      },
    },
    request: {
      device: {
        title: 'Device Access Permission',
        desc: 'If you need to enable device access permission, please click the `Allow Authorization` button below.',
        allow: 'Allow Authorization',
        deny: 'Deny Authorization',
        waiting: 'Requesting...',
        ask: 'Access to your camera and microphone is required. Please select `Allow` to continue using.',
        permission: {
          how: 'How to enable permission?',
          changed_with_reload:
            'After changing the permission, you may need to refresh the page for it to take effect.',
          set_on_hand:
            'If you previously denied permission, you may need to manually allow them in your browser settings.',
          chrome_edge: [
            'Click the lock icon to the left of the browser address bar',
            'Select `Site Settings`',
            'Choose `Allow` in the `Camera` and `Microphone` dropdown menus',
            'Refresh the page',
          ],
          firefox: [
            'Click the lock icon to the left of the browser address bar',
            'Click `Connection Security`',
            'Select `More Information`',
            'Choose `Allow` in the `Permissions` dropdown menu',
            'Refresh the page',
          ],
          safari: [
            'Open Safari Preferences (Safari menu or the gear icon in the upper right corner)',
            'Select the `Websites` tab',
            'Choose `Allow` in the `Camera` and `Microphone` dropdown menus',
            'Refresh the page',
          ],
          other: "Please refer to your browser's help documentation for more information.",
        },
      },
      user: {
        name: 'Requesting available username for you...',
      },
    },
    success: {
      device: {
        granted: 'Media permissions have been successfully granted.',
      },
      user: {
        username: {
          change: 'Username changed successfully',
        },
        lang: 'Language changed successfully',
      },
    },
  },
};
