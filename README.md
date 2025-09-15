<a href="https://space.voce.chat/rooms/bby6-x55t">
  <img src="./.github/assets/vocespace.svg" alt="VoceSpace logo" width="240" height="120">
</a>

# VoceSpace
Private-hosted 4K Video Conferencing at 60 FPS

Experience crystal-clear video meetings with 4K resolution, 60 FPS smooth performance, and 2M encoding for unmatched quality. Perfect for professional presentations and remote collaboration.

## Demo

Give it a try at [vocespace demo](https://space.voce.chat/rooms/bby6-x55t)

## Dev Setup

Steps to get a local dev setup up and running:

1. Run `pnpm install` to install all dependencies.
2. Copy `.env.example` in the project root and rename it to `.env.local`.
3. Create the configuration file `vocespace.conf.json`
4. Run `pnpm dev` to start the development server and visit [http://localhost:3000](http://localhost:3000) to see the result.
5. Start development 🎉

### vocespace.conf.json

```json
{
  "livekit": {
    "key": "your-production-key",
    "secret": "your-production-secret",
    "url": "ws://host.docker.internal:7880",
    "turn": {
      "urls": "turn:your-turn-server:3478",
      "username": "your-turn-username",
      "credential": "your-turn-password"
    }
  },
  "codec": "vp9",
  "resolution": "1080p",
  "maxBitrate": 3000000,
  "maxFramerate": 30,
  "priority": "medium",
  "redis": {
    "enabled": true,
    "host": "your-redis-host",
    "port": 6379,
    "password": "",
    "db": 0
  },
  "s3": {
    "enabled": false,
    "endpoint": "your-s3-endpoint",
    "bucket": "your-bucket",
    "accessKey": "your-access-key",
    "secretKey": "your-secret-key",
    "region": "your-region"
  },
  "serverUrl": "your-domain.com",
  "hostToken": "your-host-token"
}
```

## Features

VoceSpace offers a comprehensive video conferencing experience with advanced AI-powered features and extensive customization options.

### 🎥 Pre-Join Experience

**Basic Controls**
- [x] Microphone preview and testing
- [x] Camera preview with device selection
- [x] Real-time video preview
- [x] Custom username input with auto-generation (User 01-99 format)
- [x] One-click room joining
- [x] Username focus on entry
- [x] Optimized loading times with skeleton screens

**Advanced Settings**
- [x] Audio volume adjustment and testing
- [x] Multiple microphone device selection
- [x] Video blur intensity control with live preview
- [x] Multiple camera device selection
- [x] Settings reset functionality
- [x] Auto-generated usernames (ULID-based)
- [x] Lossless high-quality transmission
- [x] End-to-end encryption (E2EE)

### 💬 Room Experience

**Core Features**
- [x] High-quality audio/video communication (4K@60fps, 2M encoding)
- [x] Screen sharing with audio support (configurable)
- [x] Multiple layout options (Grid, Focus, Speaker view)
- [x] Real-time chat with file sharing
- [x] Drag-and-drop file uploads
- [x] Message history persistence (Redis-backed)
- [x] Unread message notifications with badges
- [x] Chat message timestamps with 5-minute grouping
- [x] Automatic message scrolling
- [x] Link preview and clickable links

**Host Management**
- [x] Room ownership and moderation
- [x] Participant management (mute, video control, remove)
- [x] Host transfer capabilities
- [x] Volume control for participants
- [x] Video/screen blur control for others
- [x] Device invitation system (camera, microphone, screen on/off)
- [x] Room security controls
- [x] Global quality settings management
- [x] Host token authentication for admin features

**Interactive Features**
- [x] Real-time cursor sharing during screen share
- [x] Wave hand notifications between users
- [x] User status indicators and custom statuses
- [x] Multi-language support (Chinese/English)
- [x] Participant search and sorting by first letter
- [x] Right-click context menus for user management
- [x] Raise hand functionality with broadcast notifications

### 🏢 Space & Room Management

**Multi-Room Architecture**
- [x] Main space with unlimited sub-rooms
- [x] Public and private room types
- [x] Room creation, deletion, and renaming
- [x] Real-time participant count display
- [x] Room permission management
- [x] Auto-collapsible sidebar with hover expansion
- [x] Room persistence settings

**Advanced Room Features**
- [x] Private room approval system
- [x] Room owner privileges and controls
- [x] Cross-room screen sharing permissions
- [x] Automatic room cleanup on exit
- [x] Room-specific user status management

### 🤖 AI-Powered Features

**Virtual Avatars**
- [x] Live2D avatar integration with facial tracking
- [x] Real-time facial tracking and animation
- [x] Multiple avatar models selection
- [x] Custom backgrounds and environments
- [x] Performance optimization and auto-detection
- [x] Seamless avatar switching with masking effects
- [x] Compare mode for before/after effects
- [x] Avatar model isolation per user

**Audio Enhancement**
- [x] AI noise cancellation
- [x] Real-time audio processing
- [x] Volume normalization
- [x] Customizable prompt sounds for new user joins

### 🎬 Recording & Media

**Room Recording**
- [x] Full room recording capabilities with 4K quality
- [x] Host-initiated recording
- [x] Participant recording requests with approval workflow
- [x] Real-time recording notifications
- [x] Automatic S3 storage integration
- [x] Download links with 3-day expiration lifecycle
- [x] Mobile recording support with permission detection
- [x] Recording management dashboard

**File Management**
- [x] In-chat file sharing with drag-and-drop
- [x] Image preview and download
- [x] Automatic file organization by room
- [x] Secure file storage and retrieval
- [x] File size and type validation

### 🎮 Built-in Applications

**Productivity Apps**
- [x] TODO List application with task management
- [x] Timer application with lap recording
- [x] Countdown timer with custom durations
- [x] Application floating windows
- [x] Collapsible app widgets
- [x] Cross-participant app data sharing

**App Management**
- [x] Host-controlled app permissions
- [x] App data upload and sync
- [x] Application history tracking
- [x] Individual app sharing controls
- [x] App data persistence across sessions

### 🔧 Advanced Settings

**Audio Configuration**
- [x] Device selection and switching
- [x] Volume controls and testing
- [x] Real-time audio quality adjustment
- [x] Screen share audio toggle
- [x] Customizable notification sounds

**Video Configuration**
- [x] Camera device management
- [x] Blur intensity controls (0-100%) with GPU acceleration
- [x] Screen share blur settings
- [x] Real-time video quality optimization
- [x] Lossless transmission mode
- [x] Dynamic quality adjustment based on connection

**Virtual Environment**
- [x] Avatar model selection with Live2D integration
- [x] Background customization
- [x] Performance monitoring and auto-adjustment
- [x] Compare mode for effects preview
- [x] WebGL-accelerated video processing

**System Preferences**
- [x] Multi-language interface (i18n)
- [x] Custom user status creation and management
- [x] Theme and UI customization
- [x] Persistent settings storage in localStorage
- [x] Auto-save settings with instant sync

### 🔒 Security & Privacy

**Encryption & Security**
- [x] End-to-end encryption (E2EE) support
- [x] Secure WebRTC communication
- [x] TURN server integration for connectivity
- [x] Unique participant ID generation
- [x] Session-based authentication

**Permissions & Access Control**
- [x] Device permission management
- [x] Detailed permission descriptions and guides
- [x] Granular access controls
- [x] Private room approval workflows
- [x] Host privilege management

### 🏗️ Technical Features

**Performance & Reliability**
- [x] Client-side performance monitoring
- [x] Server-side performance tracking with heartbeat
- [x] WebGL-accelerated video processing
- [x] Optimized codec selection (VP9/VP8/H264/AV1)
- [x] Automatic reconnection mechanisms
- [x] Connection quality monitoring
- [x] Fallback connectivity options

**Infrastructure**
- [x] Redis-based data persistence
- [x] WebSocket real-time communication with Socket.IO
- [x] Docker deployment support
- [x] S3 integration for media storage
- [x] Custom Express + Next.js server architecture
- [x] Horizontal scaling support

**Data Management**
- [x] User session management
- [x] Room state synchronization
- [x] Chat history persistence
- [x] Application data backup and restore
- [x] Automatic data cleanup and lifecycle management

### 📊 Analytics & Monitoring

**Usage Analytics**
- [x] Real-time active room monitoring
- [x] Historical usage records with daily/weekly/monthly rankings
- [x] User activity analytics and leaderboards
- [x] Performance metrics dashboard
- [x] Participant engagement tracking

**Administrative Tools**
- [x] Admin dashboard with comprehensive statistics
- [x] Real-time participant tracking across all rooms
- [x] Session duration monitoring
- [x] Resource usage optimization
- [x] Global configuration management
- [x] User management and moderation tools

**Development & Deployment**
- [x] Docker containerization
- [x] Environment-based configuration
- [x] Production/development mode differentiation
- [x] Automated deployment scripts
- [x] Performance testing and load balancing
- [x] SEO optimization and meta tags

For detailed feature specifications and implementation notes, see [FEATURE.md](./log/FEATURE.md) and [TODO.md](./log/TODO.md).

### CHANGELOG

See [CHANGELOG](./log/CHANGELOG.md)