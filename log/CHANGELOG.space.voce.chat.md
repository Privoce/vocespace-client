# CHANGELOG

## v0.2.0_pre (2025-06-18)

### General

- [x] unified theme
  - [x] other buttons
  - [x] device toggle buttons
    - [x] mircophone
    - [x] video
    - [x] screen share
  - [x] leave button
  - [x] screen share mouse cursor color
- [x] datas store in redis
  - [x] rooms
  - [x] participants
- [x] recording (hide)
  - [x] recording management
    - [x] search
    - [x] download
    - [x] delete
  - [x] recording room
- [x] host
  - [x] Add room user data (ownerId)
  - [x] The first user in the room is the host
  - [x] host manages the room
    - [x] Synchronize member data
    - [x] Separate permissions
    - [x] Conference members
    - [x] Member management
      - [x] Transfer host
      - [x] Modify name
      - [x] Mute
      - [x] Turn off video
      - [x] Volume adjustment
      - [x] Blur video
      - [x] Blur screen
  - [x] Invite
    - [x] Video
    - [x] Audio
    - [x] Screen
    - [x] Reminder wave hand
  - [x] Security
    - [x] Remove user
  - [x] Search user + sort by user alphabetically
  - [x] Share room
- [x] chat
  - [x] chat tips (badage)
  - [x] link preview
  - [x] history msg

### Fixes

- [x] control button height difference (in bar controls)
- [x] i18n
- [x] mobile phone screen recording (add mobile phone screen recording detection)
- [x] allowing screen recording permission will turn on the sound, pointing to an error
- [x] chat auto-slide down is invalid
- [x] switch the local and remote chat area positions
- [x] server.js env missing
