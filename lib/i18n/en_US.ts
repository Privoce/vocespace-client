export default {
  api: {
    token: {
      out_of_date: 'Token has expired, please obtain a new one',
    },
    room: {
      error: {
        full_and_wait: 'All rooms are full, please wait a moment', //flag
        not_exist: 'Room does not exist or has been deleted',
        invalid_identity_c_s:
          'Invalid identity type, the user can only be an assistant or a customer', //flag
      },
    },
    auth: {
      createRoom: 'Create room',
      manageRoom: 'Manage room',
      manageRole: 'Manage roles',
      controlUser: 'Control user',
      recording: 'Recording space',
      save: 'Save changes',
      saveFail: 'Save failed, please try again later',
      saveSuccess: 'Save successful',
    },
  },
  common: {
    full_screen: 'Full Screen',
    guest: {
      not_allow: 'Sorry, the current space does not allow guests to join without signing in. Please log in or sign up to continue.', 
    },
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
    no_more: 'No more data', //flag
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
    chat_placeholder: 'Click here to start typing your message to the current room',
    chat_drag_file_here: 'Drag file here',
    files: 'Files',
    upload: 'Upload',
    send: 'Send',
    sending: 'Sending',
    send_file_or: 'Please confirm you would like to share the selected file with all users currently in this room.',
    leave: 'Leave',
    share_screen: 'Share Screen',
    stop_share: 'Stop Screen Share',
    wave_msg: 'sent you a reminder!', //flag
    full_user:
      'Sorry, the room you have tried to join is currently full.',
    open: 'ON',
    close: 'OFF',
    high_quality: 'Lossless mode',
    high_quality_desc:
      'When enabled, video, audio, and screen sharing will be transmitted at a fixed resolution and higher quality. This mode may increase bandwidth usage and latency.',
    socket_reconnect: 'Reconnecting...',
    create_own_space: 'Create your own VoceSpace',
    create_space: {
      jump: 'Jump to your Vocespace?',
      success: 'Space created successfully',
      error: {
        unknown: 'Space creation failed. Please try again later or create manually.',
        param: 'Space creation failed. Some required parameters were missing.',
        exist:
          'The Space you have tried to create already exists. Please check whether it has been created or manually create it to access it.', //flag
      },
      ok: 'Jump',
      cancel: 'Cancel',
    },
    start_sharing: 'Start Sharing',
    copy: {
      success: 'Copied to clipboard',
      error: 'Copying failed, please copy manually',
    },
  },
  work: {
    title: 'Worklog',
    start: 'Start Worklog',
    close: 'End Worklog',
    desc: 'Worklog lets you automatically log your work activity based on a screen you choose to share. You have full control over what you share.',
    use_ai: 'Enable AI Work Summary',
    sync: 'Synchronize Configuration',
    sync_desc:
      'As an administrator/host, you can synchronize the following settings to all members who have enabled Worklog.', //flag
    save: {
      success: 'Worklog settings saved successfully',
      error: 'Worklog settings save failed, please try again later.',
    },
    mode: {
      start: {
        success: 'Worklog enabled',
        error: 'Failed to enable worklog, please try again later.',
      },
      stop: {
        success: 'Worklog disabled',
        error: 'Failed to disable worklog, please try again later.', //flag
      },
    },
  },
  ai: {
    cut: {
      blur: {
        title: 'Screenshot Blur',
        desc: 'You can blur worklog screenshots. Blur does not affect AI summaries. Blur is only applied to screenshots saved in the cloud and viewed by others.',
      },
      time: {
        start: 'Start Time',
        duration: 'Duration (minutes)',
      },
      extraction: {
        title: 'Summaries Level of Detail',
        desc: 'You can set how detailed you want AI summaries to be.',
        easy: 'High-level',
        medium: 'Medium',
        max: 'Max Detail',
      },
      report: 'AI Analysis Report', //flag this section 141-175, need to confirm verbage for AI "analysis" vs summary vs worklog vs report
      start: 'Start Analysis',
      stop: 'Stop Analysis',
      empty:
        'Once AI analysis is enabled, the system will periodically take screenshots and analyze them to help you summarize the content of your space and generate reports.',
      title: 'AI Analysis Settings',
      freq: 'Screenshot Frequency (minutes)',
      freq_desc:
        'Sets the screenshot frequency for AI analysis. The default is to take a screenshot every 5 minutes for analysis. If it takes longer than 5 minutes, the first screenshot will be taken at the 5-minute mark.',
      ask_permission:
        'Your AI worklog will capture screen activity. Please share the screen or window of your task.',
      ask_permission_title: 'Screen Sharing Permission',
      choose: 'Choose Screen',
      not_now: 'Not now',
      source_dep: 'AI Work Log Source Data',
      source_dep_desc:
        'Select the screen sharing source data to use for AI analysis. You can choose to share the entire screen, work to-dos, or time spent. Choosing appropriate source data helps improve the accuracy and relevance of AI analysis.',
      share_screen: 'Share Screen',
      share_todo: 'To-do List',
      share_time: 'Time Spent',
      share_timeStatistic: 'Duration',
      open: 'Enable AI analysis service',
      freq_analysis: 'AI analysis frequency (minutes)',
      myAnalysis: 'My AI analysis report',
      error: {
        res: 'Unable to retrieve AI analysis results, please try again later.',
        download: 'Unable to download Markdown report, please try again later.',
        reload: 'Unable to update AI analysis results, please try again later.',
        start:
          'Unable to start AI analysis service, please check if screen sharing permission is enabled.',
      },
      success: {
        reload: 'AI analysis results updated',
        stop: 'AI analysis service stopped',
        start: 'AI analysis service started',
      },
      download: 'Download Markdown report',
      download_content:
        'Preparing your report. This process can take up to a minute. Closing the current page will cancel the process.', //flag - closing or refreshing, or just closing?
      reload: 'Update report',
    },
  },
  login: {
    following: 'Login using the following method',
    out: 'Log out',
    anon: 'Anonymous', //flag
    guest: 'Join as a guest',
  },
  reaction: {
    title: 'Reaction', //flag - where is this?
  },
  recording: {
    title: 'Saved Recordings',
    empty: 'No recordings saved yet',
    fresh: 'Refresh list',
    search: {
      success: 'Successfully searched for recording files', //flag maybe Found the following files, cant see in UI where to run search
      error:
        'No recording files found. Please check if the room name is correct. The room may not have any recorded video files, or it may have been deleted.',
    },
    try_s3: {
      unavailable: 'The storage service is not configured or the environment variables are not set',
      init: 'Successfully retrieved the simple storage service environment variables',
      connected: 'Connected to the storage service',
      connect_error:
        'Unable to connect to the storage service. You may be accessing a local service. Please check the configuration or contact the administrator.',
      connecting: 'Connecting to the storage service...',
      enving: 'Getting environment variables...',
      unconnect: 'Unable to connect to the storage service',
    },
    copy: {
      title: 'Copy Link',
      success: 'Link successfully copied to clipboard',
      error: 'Failed to copy link, please copy manually',
    },
    get_download_link: {
      success: 'Successfully got download link', //flag need to see context
      error: 'Failed to get download link, please try again later',
    },
    delete: {
      title: 'Delete',
      confirm: {
        title: 'Confirm deletion',
        content: [
          'Are you sure you want to delete the recording file?', //flag - selected files or file(s) or file
          'Deleted files cannot be recovered.',
        ],
        ok: 'Delete',
        cancel: 'Cancel',
      },
      success: 'Deleted successfully',
      error: 'Deletion failed, please try again later',
    },
    download: {
      title: 'Download',
      success: 'Download link successfully obtained, file downloading...',
      error:
        'Failed to obtain download link, please try again later or contact the space administrator',
    },
    table: {
      file: 'File name',
      opt: 'Operation', //flag
      size: 'File size',
      last_modified: 'Last modified',
      ty: 'Type',
      ty_json: 'Record file', //flag
      ty_video: 'Video file',
    },
    pagation: {
      total: 'Total',
      num: 'Items',
      now: 'Number',
    },
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
      success: 'Joined room successfully',
    },
    delete: {
      success: 'Deleted room successfully',
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
      success: 'Left room, returned to lobby successfully',
      error: 'Failed to leave room, please try again later. ',
    },
    modal: {
      title: 'Create a room',
      desc: [
        'Rooms are places to meet, host activities, or work on your own. Like setting up at a coffee shop, library, or coworking space. Anybody can join a public room. Users need permission to join private rooms.',
        'Signed-in users can see rooms in the space. You can only hear the room you are currently in. Guests cannot see anything outside the room they are in.', //flag need to understand visibility differences across permission levels
      ],
      placeholder: 'Please enter the room name',
      cancel: 'Cancel',
      ok: 'Create a room',
      privacy: {
        title: 'Privacy',
        public: {
          title: 'Public',
          desc: 'Public rooms: Any participant in the space can join freely. Room permissions are loose. Suitable for open discussions.',
        },
        private: {
          title: 'Private',
          desc: 'Private rooms: Joining requires permission from the room owner. Room permissions are completely controlled by the owner. Suitable for private meetings and events.',
        },
        success: 'Privacy switch successful, currently is',
      },
      join: {
        title: 'Request to join the room',
        want: 'wants to join the room. May they enter?', //flag - what happens when multiple people try to join at the same time? do we have a queue? Admit All button?
        ok: 'Yes',
        cancel: 'No',
        missing_data:
          'Joining data is not available. If you see this error, please contact the space administrator.',
        reject: 'The door will not budge.', //flag Space admins should be able to set custom responses to room accept and deny
        missing_owner: 'The room owner is currently offline and cannot process your request.', //flag I don't see this notice appear when I try to join empty rooms
      },
      rename: {
        title: 'Rename room',
        desc: 'Please enter a new room name. The room name can be modified at any time. Two rooms in a space cannot have the same name.',
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
    platform: 'Profile Page',
    ai: {
      cut: 'AI Analysis',
      desc: "Timed screenshots and AI analysis help you summarize your space's content and generate reports.",
    },
    app: {
      title: 'Application',
      raise: {
        cancel: 'Cancel Raise Hand',
        title: 'Raise Hand',
        receive: 'raised their hand',
        handle: {
          title: 'Handling Request', //flag - this feature can probably be deleted. its sufficient to simply notify room owners of raised hands
          accept: 'Allow',
          accept_desc: 'Allow the user to speak and notify them that they can speak.',
          reject: 'Decline',
          reject_desc:
            "Decline the user's request to speak, notify them, and cancel their raised hand status.",
          rejected: 'Sorry, your request to speak has been declined.',
          accepted: 'Your raised hand has been called on. Please begin speaking.',
        },
      },
      upload: { //flag - what it this?
        to_space: 'Upload application to space',
        history: 'Upload history',
        success: 'Application upload successful',
        error: 'Application upload failed. Please try again later.',
      },
      tab: {
        self: 'self', //flag ?
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
        title: 'To-Do',
        add: 'Add task',
        placeholder: 'Please enter to-do',
        empty: 'No tasks available, please create new tasks below',
        create: 'Create todo',
        empty_value: 'To-do cannot be empty',
        delete: 'To-do deleted successfully',
        undone: 'Undone',
        done: 'Done',
        unexport: 'Current to-do is empty, cannot export',
        complete: 'Completed Tasks',
        together: {
          title: 'Team Status',
          empty: 'No user task available',
        },
        copy: 'Copy todo',
        today_done: 'Completed today',
        history: 'Current list',
        today_empty: 'No task completed today, keep going!',
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
        'The recording is complete and is being transferred to cloud storage. You can access saved recordings in Settings.',
      download: 'Download recording',
      to_download: 'Download Page',
    },
    participant: {
      title: 'Participants',
      manage: 'Manage Participants',
      search: 'Search Participants',
      manager: 'Manager',
      host: 'Host',
      wave: 'Send Greeting',
      invite: {
        title: 'Invite Participants',
        web: 'in Browser',
        add: 'add into VoceSpace room',
        texts: [
          "$user invites you to join [$space]'s VoceSpace",
          "Please click or copy the following link and join [$space]'s VoceSpace in browser",
        ],
        ok: 'Copy Invite',
        cancel: 'Cancel',
        link: 'Join link',
        room: 'Room Name',
      },
      set: {
        invite: {
          title: 'Participant Invite',
          wave: 'Send a Reminder',
          open: {
            video: 'Invite to Turn On Camera',
            audio: 'Invite to Unmute',
            share: 'Invite to Share Screen',
          },
          close: {
            video: 'Invite to Disable Camera', //flag - if this is an admin action, "invite to" should be deleted. is it just a request?
            audio: 'Invite to Disable Microphone',
            share: 'Invite to Stop Sharing Screen',
          },
        },
        control: {
          title: 'Participant Control',
          trans: 'Transfer Room Host',
          trans_manager: 'Transfer Manager Role',
          set_manager: 'Grant Manager Permissions',
          remove_manager: 'Remove Manager Permissions',
          change_name: 'Change Name',
          mute: {
            audio: 'Mute Microphone',
            video: 'Turn Off Video',
            screen: 'Stop Screen Sharing',
          },
          volume: 'Volume Adjustment',
          blur: {
            video: 'Blur Camera Video',
            screen: 'Blur Shared Screen',
          },
        },
        safe: {
          title: 'Admin',
          remove: {
            title: 'Remove member',
            desc: 'Are you sure you want to remove this member? ',
            confirm: 'Confirm removal',
            cancel: 'Cancel',
          },
          leave: {
            title: 'Leave VoceSpace', //flag - probably brand with $space
            desc: 'Are you sure you want to leave VoceSpace?',
            confirm: 'Yes',
            cancel: 'Cancel',
          },
        },
      },
    },
  },
  settings: {
    title: 'Settings',
    ai: {
      title: 'AI',
      desc: 'Configure the relevant parameters of the AI ​​analysis service to enable AI analysis functions.',
      model: 'Model name (multimodal model)',
      model_desc:
        'Select the language model for AI analysis. The model name must support multimodal input (image + text) to process screenshots and generate analysis reports.',
      key: 'API key',
      url: 'API address',
      recommand: [
        'We recommend using the following multimodal models for better AI analysis results:',
        '1. GPT-4V',
        '2. Claude-3-vision',
        '3. Gemini-Pro-Vision',
        '4. Qwen3',
        '5. Doubao',
      ],
      enabled: 'AI inquiry pop-up',
      update: {
        save: 'Save AI configuration',
        success: 'AI configuration update successful',
        error: 'AI configuration update failed, please try again later. ',
        incomplete:
          'Please fill in the AI ​​configuration parameters completely, ensuring that the model name, API address, and API key are all entered.',
      },
      precheck: {
        desc: 'To modify AI settings, you need to enter a host token for verification. If you do not know your host token, please contact the software deployer to obtain it.',
        placeholder: 'Please enter your host token',
        check: 'Verify',
        error: 'Verification failed. Please check and re-enter.',
        success: 'Verification successful. You can now modify AI settings.',
      },
    },
    general: {
      title: 'General',
      username: 'Username',
      lang: 'Language',
      share_audio: 'Share Screen Audio',
      prompt_sound: 'Enter Prompt Sound',
      persistence: {
        title: 'Auto-save Rooms and Members History Data',
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
        allow_guest: {
          title: 'Guest Permission',
          allow: 'Allow guests to join',
          disable: 'Disable guest to join',
          link: 'Allow guest joining a private room with an invitation link',
          success: 'Guest join settings modified successfully',
          error: 'Failed to set guest access for the current space',
        },
      },
      status: { //flag is this feature enabled? i see status text edit field, but no preset options like below
        title: 'State',
        online: 'Online',
        online_desc: "Online, user's video and audio will work normally",
        leisure: 'On break',
        leisure_desc: "On break, user's video will be blurred, audio will not be adjusted",
        busy: 'Busy',
        busy_desc: "Busy, user's video will be blurred, audio will be muted",
        offline: 'Away',
        offline_desc: "Away, user's video and audio will be turned off",
        working: 'Working',
        working_desc: 'Dependency to-do auto generates current work status',
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
        icon: 'State Icon',
        placeholder: {
          name: 'Please enter state name',
          desc: 'Please enter state description',
        },
        save: 'Save State',
        success: 'State saved successfully',
        fail: 'Failed to save state',
      },
    },
    license: {
      title: 'License',
      signed: 'Signed',
      domains: 'Domains',
      limit: 'Limit',
      person: 'Person Limit',
      created_at: 'Created At',
      expires_at: 'Expires At',
      value: 'License Value',
      renew: 'Renew License',
      update: 'Update Manually',
      input: 'Please enter license',
      gift: {
        title: 'A chance to get a free upgrade! 🎁',
        desc: 'Share your experience through blog posts or social media to get a chance to upgrade for free. Add WeChat to get: Privoce', //flag clarify ask
      },
      license_pro: 'VoceSpace Pro [$499/year]',
      license_custom: 'VoceSpace Custom',
      price_select: 'Please select a price package',
      meeting: 'Subscribe to a meeting',
      buy: 'Purchase a certificate',
      invalid: 'The certificate is invalid or expired. Please check if it is correct.',
      invalid_domain:
        'The current domain is not in the list of allowed domains for the certificate. Please contact the administrator to check the server domain configuration.',
      default_license: //flag clarify, this is for free trial?
        'To ensure your use, the current system has loaded a default certificate for you. The default certificate only supports temporary rooms with fewer than 5 people. If you would like to host more users, please purchase a professional certificate.',
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
      video_blur: 'Camera Video Blur',
      screen_blur: 'Shared Screen Blur',
      device: 'Video Input Device',
    },
    virtual: {
      title: 'Video Preview',
      tab: {
        model: 'Video Avatar',
        background: 'Video Avatar Background',
      },
      open: 'Enable Video Avatar',
      model: 'Selected Video Avatar',
      background: 'Selected Video Avatar Background',
      none: 'None',
      none_warning: 'Please select a video avatar before comparing',
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
      title: 'Your virtual co-working space, developed by Privoce',
      contact: 'Contact',
      learn_more: 'Learn More',
      offical_web: 'official website',
      try_free: 'Create a one-time new VoceSpace.',
      try_enter_room: 'Enter your VoceSpace name or link to join or create.',
      connect_with_server: 'Connect Voce Space with a custom server using Voce Space Server.',
      enabled_e2ee: 'End-to-end encryption enabled',
      enter_room: 'Please enter the space name or link',
      virtual_loading: 'Loading video avatar, please wait...',
      invite_device: 'Inviting you to enable:',
      remove_participant: 'You have been removed from the room by the room host',
      req_record: 'Request to start recording',
      file: {
        upload_cancelled: 'File upload cancelled',
      },
    },
    error: {
      client: {
        title: 'Client Error',
        sub: 'Client encountered an error, please check the console logs for more details. Please contact the administrator.',
        back: 'Back',
        connect: 'Email: han@privoce.com',
      },
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
        manager_limit: 'Manager seats are full. Please remove a manager to set a new one.',
        username: {
          change: 'Username changed failed',
          request: 'Failed to request username',
          exist: 'Username already exists, please choose another name',
        },
      },
      file: {
        upload: 'File upload failed',
        download: 'File download failed',
        too_large: 'File too large, maximum supported:',
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
            'After changing permission settings, you may need to refresh the page to take effect.',
          set_on_hand:
            'If you previously denied or missed a browser permission request, you may need to manually allow them in your browser settings.',
          chrome_edge: [
            'Click the little icon between the refresh button and the website URL in the upper left corner of your browser',
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
        start: 'The room has started recording', //flag unclear what exactly is being recorded - all screens? gallery view? view of the user who pressed record?
        stop: 'The room recording has been stopped. The recording status will be removed after 10 seconds.', //flag why the 10s delay?
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
        transfer: 'You have been successfully transferred',
        set_manager: 'You have been granted manager permissions',
        remove_manager: 'Your manager status has been removed',
      },
      file: {
        upload: 'File uploaded successfully',
      },
    },
  },
  dashboard: {
    common: {
      day: 'Day',
      week: 'Week',
      month: 'Month',
      year: 'Year',
      total: 'Total',
      during: 'Duration',
    },
    conf: {
      resolution: 'Configure global graphics quality',
      verify: 'Verify',
      close: 'Close',
      placeholder: 'Please enter administrator token',
      error: {
        verify: 'Administrator token error, please try again',
        not_loaded:
          'Configuration not loaded or unable to obtain configuration, please try again later',
      },
      success: {
        update: 'Configuration updated',
      },
    },
    count: {
      room: 'Rooms',
      participant: 'All users',
      online_participant: 'Online users',
      platform: 'Platform users',
      opt: 'Operation',
      refresh: 'Refresh data',
      global_conf: 'Configure Image Quality (Global)',
      history: {
        title: 'Historical Room Statistics',
        day: 'Daily Ranking',
        week: 'Weekly Ranking',
        month: 'Monthly Ranking',
        table: {
          room: 'Room Name',
          total: 'Total Duration',
          today: "Today's Duration",
        },
        empty: 'No Records',
      },
    },
    active: {
      empty_room: 'No Active Rooms',
      title: 'Current Active Users',
      table: {
        participant: 'User',
        state: 'Status',
        volume: 'Volume',
        blur: 'Camera Video Blur',
        screen_blur: 'Shared Screen Blur',
        is_auth: 'Authenticated',
        during: 'Online Duration',
      },
    },
  },
};
