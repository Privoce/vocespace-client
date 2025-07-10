<a href="https://space.voce.chat/rooms/bby6-x55t">
  <img src="./.github/assets/vocespace.svg" alt="VoceSpace logo" width="240" height="120">
</a>

# VoceSpace

## Demo

Give it a try at [vocespace demo](https://space.voce.chat/rooms/bby6-x55t)

## Dev Setup

Steps to get a local dev setup up and running:

1. Run `pnpm install` to install all dependencies.
2. Copy `.env.example` in the project root and rename it to `.env.local`.
3. Update the missing environment variables in the newly created `.env.local` file.
4. Run `pnpm dev` to start the development server and visit [http://localhost:3000](http://localhost:3000) to see the result.
5. Start development 🎉

## Features

VoceSpace offers a comprehensive video conferencing experience with advanced AI-powered features and extensive customization options.

### 🎥 Pre-Join Experience

**Basic Controls**
- [x] Microphone preview and testing
- [x] Camera preview with device selection
- [x] Real-time video preview
- [x] Custom username input with auto-generation
- [x] One-click room joining

**Advanced Settings**
- [x] Audio volume adjustment and testing
- [x] Multiple microphone device selection
- [x] Video blur intensity control with live preview
- [x] Multiple camera device selection
- [x] Settings reset functionality
- [x] Auto-generated usernames (ULID-based)

### 💬 Room Experience

**Core Features**
- [x] High-quality audio/video communication
- [x] Screen sharing with audio support
- [x] Multiple layout options (Grid, Focus, Speaker view)
- [x] Real-time chat with file sharing
- [x] Drag-and-drop file uploads
- [x] Message history persistence (Redis-backed)
- [x] Unread message notifications

**Host Management**
- [x] Room ownership and moderation
- [x] Participant management (mute, video control, remove)
- [x] Host transfer capabilities
- [x] Volume control for participants
- [x] Video/screen blur control for others
- [x] Device invitation system (camera, microphone, screen)
- [x] Room security controls

**Interactive Features**
- [x] Real-time cursor sharing during screen share
- [x] Wave hand notifications between users
- [x] User status indicators and custom statuses
- [x] Multi-language support (Chinese/English)
- [x] Participant search and sorting

### 🤖 AI-Powered Features

**Virtual Avatars**
- [x] Live2D avatar integration
- [x] Real-time facial tracking and animation
- [x] Multiple avatar models selection
- [x] Custom backgrounds and environments
- [x] Performance optimization and detection
- [x] Seamless avatar switching with masking effects

**Audio Enhancement**
- [x] AI noise cancellation
- [x] Real-time audio processing
- [x] Volume normalization

### 🎬 Recording & Media

**Room Recording**
- [x] Full room recording capabilities
- [x] Host-initiated recording
- [x] Participant recording requests with approval
- [x] Real-time recording notifications
- [x] Automatic S3 storage integration
- [x] Download links with expiration (3-day lifecycle)
- [x] Mobile recording support with permission detection

**File Management**
- [x] In-chat file sharing
- [x] Image preview and download
- [x] Automatic file organization by room
- [x] Secure file storage and retrieval

### 🔧 Advanced Settings

**Audio Configuration**
- [x] Device selection and switching
- [x] Volume controls and testing
- [x] Real-time audio quality adjustment

**Video Configuration**
- [x] Camera device management
- [x] Blur intensity controls (0-100%)
- [x] Screen share blur settings
- [x] Real-time video quality optimization

**Virtual Environment**
- [x] Avatar model selection
- [x] Background customization
- [x] Performance monitoring and auto-adjustment
- [x] Compare mode for before/after effects

**System Preferences**
- [x] Multi-language interface (i18n)
- [x] Custom user status creation
- [x] Theme and UI customization
- [x] Persistent settings storage

### 🔒 Security & Privacy

**Encryption**
- [x] End-to-end encryption (E2EE) support
- [x] Secure WebRTC communication
- [x] TURN server integration for connectivity

**Permissions**
- [x] Device permission management
- [x] Detailed permission descriptions and guides
- [x] Granular access controls

### 🏗️ Technical Features

**Performance**
- [x] Client-side performance monitoring
- [x] Server-side performance tracking
- [x] WebGL-accelerated video processing
- [x] Optimized codec selection

**Infrastructure**
- [x] Redis-based data persistence
- [x] WebSocket real-time communication
- [x] Docker deployment support
- [x] S3 integration for media storage
- [x] Dashboard with usage analytics

**Reliability**
- [x] Automatic reconnection mechanisms
- [x] Connection quality monitoring
- [x] Fallback connectivity options
- [x] Error handling and recovery

### 📊 Analytics & Monitoring

**Usage Tracking**
- [x] Active room monitoring
- [x] Historical usage records
- [x] User activity analytics
- [x] Performance metrics dashboard

**Room Management**
- [x] Real-time participant tracking
- [x] Session duration monitoring
- [x] Resource usage optimization

For detailed feature specifications and implementation notes, see [FEATURE.md](./log/FEATURE.md) and [TODO.md](./log/TODO.md).

### CHANGELOG

See [CHANGELOG](./log/CHANGELOG.md)