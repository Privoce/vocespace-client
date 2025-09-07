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
    chat_placeholder: 'Please enter a message',
    send: 'Send',
    send_file_or: 'Do you want to send this file?',
    leave: 'Leave',
    share_screen: 'Share Screen',
    stop_share: 'Stop Share Screen',
    wave_msg: 'sent you a reminder!',
    full_user:
      'The room user has exceeded the limit and cannot join. You can join other rooms or inform the builder to upgrade your license to obtain more user slots.',
    open: 'Open',
    close: 'Close',
    high_quality: 'Lossless mode',
    high_quality_desc:
      'When enabled, video, audio, and screen sharing will be transmitted at a fixed resolution and higher quality, but may increase bandwidth usage and latency.',
    socket_reconnect: 'Reconnecting...',
  },
  recording: {
    title: 'Recording',
  },
  channel: {
    menu: {
      header: '',
      main: 'Space',
      sub: 'Rooms',
      create: 'Create room',
      join: 'Join',
      setting: 'Settings',
      delete: 'Delete room',
      leave: 'Leave room',
      rename: 'Rename',
      switch_privacy: 'Set to ',
      active: 'active',
    },
    join: {
      title: 'Join Room',
      success: 'Join room successfully',
    },
    delete: {
      success: 'Delete room successfully',
      error: 'Failed to delete room, please try again later. ',
      remain:
        'There are still members in the room and it cannot be deleted. Please notify all members to leave the room first.',
    },
    create: {
      success: 'Room created successfully',
      error: 'Failed to create room, please try again later. ',
      empty_name: 'Room name cannot be empty',
    },
    leave: {
      success: 'Leave room, return to Space successfully',
      error: 'Failed to leave room, please try again later. ',
    },
    modal: {
      title: 'Create a room',
      desc: [
        'After creating a room, you can invite other participants to join the room. Rooms can be used for specific discussions or activities.',
        'In a room, the Space is still visible, and you can return to the Space at any time to communicate. For participants in the Space, they cannot hear the discussion content of the room, but they can see the existence of the room.',
      ],
      placeholder: 'Please enter the room name',
      cancel: 'Cancel',
      ok: 'Create a room',
      privacy: {
        title: 'Privacy',
        public: {
          title: 'Public',
          desc: 'Public rooms, any participant in the space can join freely, room permissions are loose, suitable for open discussions.',
        },
        private: {
          title: 'Private',
          desc: 'Private rooms, room permissions are completely controlled by the owner, only with the consent of the room owner can join, suitable for discussions that require privacy protection.',
        },
        success: 'Privacy switch successful, currently is',
      },
      join: {
        title: 'Request to join the room',
        want: 'Want to join the room, do you agree? ',
        ok: 'Agree',
        cancel: 'Reject',
        missing_data:
          'Joining data is not available. If you see this error, please contact the development team. ',
        reject: 'Sorry! You are rejected to join the room. ',
        missing_owner: 'The room owner is currently offline and cannot process your request.',
      },
      rename: {
        title: 'Rename room',
        desc: 'Please enter a new room name. The room name can be modified at any time. But it cannot be the same as other existing room names. ',
        placeholder: 'Please enter a new room name',
        ok: 'Rename',
        cancel: 'Cancel',
        empty_name: 'Room name cannot be empty',
        success: 'Room rename successful',
        error: 'Room rename failed. Please try again later. ',
        repeat: 'Room name already exists. Please choose another name. ',
      },
      remove: {
        before: 'You have been removed from: ',
        after: ' room, the room has been deleted.',
      },
    },
  },
  more: {
    title: 'More',
    channel: 'Channel',
    app: {
      title: 'Application',
      upload: {
        to_space: 'Upload application to space',
        history: 'Upload history',
        success: 'Application upload successful',
        error: 'Application upload failed. Please try again later.',
      },
      tab: {
        self: 'self',
        no_auth: 'This user does not have read/write permissions enabled',
      },
      settings: {
        filter: 'Filter required apps',
        desc: 'VoceSpace provides a variety of apps. As the host, you can select the apps that participants can use here.',
        no_permission: 'You do not have permission to manage apps. Please contact the host.',
        update: {
          success: 'App settings updated successfully',
          error: 'App settings update failed. Please try again later.',
        },
        sync: {
          title: 'Synchronize App Data',
          auth: 'App Permissions',
          auth_desc: 'Control other participants permissions on your app data',
          desc_pub: 'Set visiblility to everyone can view',
          desc_priv: 'Set visiblility to only me',
          read: 'Read',
          write: 'Read & write',
          none: 'None',
          update: {
            success: 'App settings updated successfully',
            error: 'App settings update failed. Please try again later.',
          },
        },
      },
      timer: {
        title: 'Timer',
      },
      countdown: {
        title: 'Countdown',
        placeholder: 'Select countdown time',
        set: 'Set time',
        error: {
          set: 'Please set countdown time first',
          valid: 'Please set a valid countdown time',
        },
      },
      todo: {
        title: 'Todo',
        add: 'Add todo',
        placeholder: 'Please enter todo',
        empty: 'No todo, enter todo below and click the add button to create a new todo',
        create: 'Create todo',
        empty_value: 'Todo cannot be empty',
        delete: 'Todo deleted successfully',
      },
    },
    record: {
      start: 'Record',
      stop: 'Stop recording',
      title: 'Record room',
      desc: 'VoceSpace will record the audio and video in the room. Please note that recording may affect performance. You will receive a notification after the recording is finished and can download it from the download page after the transfer is complete.',
      request:
        "Since you are not the room host, you cannot record directly. If you need to record, please click the 'Request recording' button. The room host will receive your request and will start recording if they agree.",
      confirm: 'Start recording',
      confirm_request: 'Request recording',
      cancel: 'Cancel',
      download_msg:
        'The recording is complete and is being transferred to the cloud for storage. You can access the records of the current service to download it. ',
      download: 'Download recording',
      to_download: 'Download Page',
    },
    participant: {
      title: 'Participants',
      manage: 'Manage Participants',
      search: 'Search Participants',
      manager: 'host',
      invite: {
        title: 'Invite Participants',
        web: 'in Browser',
        add: 'add into VoceSpace Room',
        texts: [
          'Invite you to join VoceSpace',
          'Please click|copy the following link to',
          'Please copy the following room name to',
        ],
        ok: 'Copy Invite',
        cancel: 'Cancel',
        link: 'Link',
        room: 'Room Name',
      },
      set: {
        invite: {
          title: 'Participant Invite',
          wave: 'Send a Reminder',
          open: {
            video: 'Invite to Enable Camera',
            audio: 'Invite to Enable Microphone',
            share: 'Invite to Share Screen',
          },
          close: {
            video: 'Invite to Disable Camera',
            audio: 'Invite to Disable Microphone',
            share: 'Invite to Stop Sharing Screen',
          },
        },
        control: {
          title: 'Participant Control',
          trans: 'Transfer Room Host',
          change_name: 'Change Name',
          mute: {
            audio: 'Mute Microphone',
            video: 'Turn Off Video',
            screen: 'Stop Screen Sharing',
          },
          volume: 'Volume Adjustment',
          blur: {
            video: 'Video Blur',
            screen: 'Screen Blur',
          },
        },
        safe: {
          title: 'Safe',
          remove: {
            title: 'Remove member',
            desc: 'Are you sure you want to remove this member? ',
            confirm: 'Confirm removal',
            cancel: 'Cancel',
          },
          leave: {
            title: 'Leave VoceSpace',
            desc: 'Are you sure you want to leave VoceSpace?',
            confirm: 'Confirm to leave',
            cancel: 'Cancel',
          },
        },
      },
    },
  },
  settings: {
    title: 'Settings',
    general: {
      title: 'General',
      username: 'Username',
      lang: 'Language',
      share_audio: 'Share Screen Audio',
      prompt_sound: 'Enter Prompt Sound',
      persistence: {
        title: 'Persistent Space',
        success: 'Successfully set the current space to persistent',
        error: 'Failed to set the current space to persistent',
      },
      conf: {
        load_error:
          'Configuration loading failed, please check if the vocespace.conf.json file exists',
        reload_env_error: 'Configuration reload failed',
        reload_env:
          'VoceSpace space configuration is updated, the current space is being automatically updated',
        reloading: 'VoceSpace is reloading, please wait...',
        reload: 'Reload configuration',
        maxFramerate: 'Maximum frame rate',
        maxBitrate: 'Maximum bitrate',
        resolution: 'Resolution',
        codec: 'Codec',
        priority: 'Priority',
        quality: {
          define: 'Custom image quality',
          title: 'Image quality',
          smooth: 'Smooth',
          standard: 'Standard',
          high: 'High',
          hd: 'HD',
          ultra: 'Ultra',
        },
      },
      status: {
        title: 'Status',
        online: 'Online',
        online_desc: "Online, user's video and audio will work normally",
        leisure: 'Leisure',
        leisure_desc: "Leisure, user's video will be blurred, audio will not be adjusted",
        busy: 'Busy',
        busy_desc: "Busy, user's video will be blurred, audio will be muted",
        offline: 'Away',
        offline_desc: "Away, user's video and audio will be turned off",
        define: {
          title: 'Custom state',
          name: 'State name',
          desc: 'State description',
          icon: 'State icon',
          placeholder: {
            name: 'Please enter the state name',
            desc: 'Please enter the state description',
          },
          save: 'Save state',
          success: 'Create new state successfully',
          fail: 'Failed to create new state',
        },
      },
      define: {
        title: 'Custom Status',
        name: 'Status Name',
        desc: 'Status Description',
        icon: 'Status Icon',
        placeholder: {
          name: 'Please enter status name',
          desc: 'Please enter status description',
        },
        save: 'Save Status',
        success: 'Status saved successfully',
        fail: 'Failed to save status',
      },
    },
    license: {
      title: 'License',
      signed: 'Signed',
      domains: 'Domains',
      limit: 'Limit',
      created_at: 'Created At',
      expires_at: 'Expires At',
      value: 'License Value',
      renew: 'Renew License',
      update: 'Update Manually',
      input: 'Please enter license',
      gift: {
        title: 'A chance to get a free upgrade! 🎁',
        desc: 'Share your experience through blog posts or social media to get a chance to upgrade for free. Add WeChat to get: Privoce',
      },
      license_pro: 'VoceSpace Pro [$499/year]',
      license_custom: 'VoceSpace Custom',
      price_select: 'Please select a price package',
      meeting: 'Subscribe to a meeting',
      buy: 'Purchase a certificate',
      invalid: 'The certificate is invalid or expired. Please check if it is correct.',
      update_success: 'The certificate was updated successfully',
      circle_ip:
        'Your current IP address is a loopback address/private address, and we do not recommend purchasing a license for this address. Please purchase a license using a public IP address. If you need to purchase licenses and support services for private addresses, please contact WeChat: Privose.',
      confirm_ip: 'Please confirm your IP address is correct!',
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
        model: 'Model',
        background: 'Background',
      },
      open: 'Enable Virtual Role',
      model: 'Virtual Role Model',
      background: 'Virtual Role Background',
      none: 'None',
      none_warning: 'Please select a virtual role model before comparing',
    },
    about_us: {
      title: 'About Us',
      brief: 'Secure Video Calls Under Your Domain and Brand',
      desc: 'We will help you host your own secure video and audio conferencing platform under your subdomain with your own logo and branding. Complete control over your data with enterprise-grade encryption.',
    },
    device: {
      audio: {
        title: 'Audio Device',
        desc: 'Select your audio input device.',
      },
      video: {
        title: 'Video Device',
        desc: 'Select your video input device.',
      },
      screen: {
        title: 'Screen Sharing',
        desc: 'Select your screen sharing device.',
      },
    },
  },
  msg: {
    info: {
      title: 'Your cyber co-working space developed by Privoce',
      contact: 'Contact',
      learn_more: 'Learn More',
      offical_web: 'official website',
      try_free: 'Create a one-time new VoceSpace.',
      try_enter_room: 'Enter your VoceSpace name or link to join or create.',
      connect_with_server: 'Connect Voce Space with a custom server using Voce Space Server.',
      enabled_e2ee: 'End-to-end encryption enabled',
      enter_room: 'Please enter the space name or link',
      virtual_loading: 'Loading virtual role, please wait...',
      invite_device: 'Inviting you to enable:',
      remove_participant: 'You have been removed from the room by the room host',
      req_record: 'Request to start recording',
    },
    error: {
      conf_load:
        'Configuration loading failed, please check whether the vocespace.conf.json file exists',
      record: {
        copy: 'Failed to copy the recording link',
        email: {
          empty: 'Email address cannot be empty',
        },
      },
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
          request: 'Failed to request username',
          exist: 'Username already exists, please choose another name',
        },
      },
      file: {
        upload: 'File upload failed',
        download: 'File download failed',
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
          wechat: [
            'WeChat Browser may not support direct access to the camera, microphone, and screen sharing. Please use another browser.',
            'You can open the link in WeChat Browser and then choose another browser to access it.',
            'Please note that WeChat Browser may limit certain features. Please use a mainstream browser such as Chrome or Firefox.',
          ],
          other: "Please refer to your browser's help documentation for more information.",
        },
      },
      user: {
        name: 'Requesting available username for you...',
      },
    },
    success: {
      record: {
        start: 'The room has successfully started recording',
        stop: 'The room recording has been successfully stopped. The recording status will be removed after 10 seconds.',
        copy: 'Recording link copied to clipboard',
      },
      device: {
        granted: 'Media permissions have been successfully granted.',
        mute: {
          audio: 'Audio-Microphone device muted',
          video: 'Video-Camera device is turned off',
          screen: 'Screen sharing stopped',
        },
      },
      user: {
        username: {
          change: 'Username changed successfully',
        },
        lang: 'Language changed successfully',
        transfer: 'You are now the host',
      },
    },
  },
};
