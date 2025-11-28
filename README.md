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
    "host": "host.docker.internal",
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
  "hostToken": "your-host-token",
  "license": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImhhbkBwcml2b2NlLmNvbSIsImV4cGlyZXNfYXQiOjQ4OTEzMzQ0MDAsImNyZWF0ZWRfYXQiOjE3MzU2NjA4MDAsImRvbWFpbnMiOiIqIiwibGltaXQiOiJmcmVlIiwiaWQiOiI2NGUyMjYwZS0xMzQwLTQxNjQtOWNmZC0zMGUwMjhlYTg0ZWQifQ.T0vIHUCxv9j75lb92RDDaegpPO9W9hxWEXqZVidwL0E",
  "ai": {
    "enabled": true,
    "apiKey": "your-ai-api-key",
    "apiUrl": "your-ai-api-url",
    "model": "your-ai-model",
    "maxTokens": 4000
  }
}
```

## Features

VoceSpace offers a comprehensive video conferencing experience with advanced AI-powered features and extensive customization options.

### 🎥 Pre-Join Experience

**Basic Controls**

- [x] Microphone Preview and Test
- [x] Camera Preview and Device Selection
- [x] Live Video Preview
- [x] Custom Username Input and Auto-Generation (User 01-99 Format)
- [x] One-Click Room Joining
- [x] Username Focus Upon Entry
- [x] Optimized Loading Time with Skeleton Screen

**Advanced Settings**

- [x] Volume Adjustment and Test
- [x] Multi-Microphone Device Selection
- [x] Video Blur Intensity Control with Live Preview
- [x] Multi-Camera Device Selection
- [x] Camera Flip Support (Mobile)
- [x] Settings Reset Function
- [x] Auto-Generate Username (ULID Based)
- [x] First Joiner Automatically Named admin
- [x] High-Quality Lossless Transmission
- [x] End-to-End Encryption (E2EE)
- [x] Device Permission Detection and Bootstrapping

### 💬 Room Experience

**Core Features**

- [x] High-quality audio and video communication (4K@60fps, 2M encoding)
- [x] Screen sharing with audio support (configurable)
- [x] Multiple layout options (grid, focus, speaker view)
- [x] Customizable pagination controls and layout
- [x] Real-time chat and file sharing
- [x] Drag-and-drop file upload (maximum 100MB)
- [x] File upload progress display and cancellation function
- [x] Message history persistence (Redis support)
- [x] Unread message notification (with badge)
- [x] Chat message timestamps, 5-minute grouping
- [x] Automatic message scrolling to the latest
- [x] Link preview and clickable links
- [x] Mobile-responsive layout and controls

**Host Management**

- [x] Room ownership and host
- [x] Participant management (mute, video control, removal)
- [x] Host transfer function
- [x] Participant volume control
- [x] Other people's video/screen blur control
- [x] Device invitation system (camera, microphone, screen switch)
- [x] Room security control
- [x] Global quality settings management
- [x] Host token authentication for admin functions

**Interactive Features**

- [x] Real-time cursor sharing during screen sharing
- [x] Hand gesture notification and room invitation between users
- [x] User status indicator and custom status
- [x] Real-time user status synchronization and updates
- [x] Multi-language support (Chinese/English)
- [x] Search and sort participants by first letter
- [x] Right-click menu for user management
- [x] Hand-raising function with broadcast notification
- [x] Hand-raising speaking permission control and host approval
- [x] Hand-raising queue and status display
- [x] Quick sending of reaction emoticons

### 🏢 Space and Room Management

**Multi-room Architecture**

- [x] Main space containing an unlimited number of sub-rooms
- [x] Public and Private Room Types
- [x] Default Sub-Rooms (Meeting Room, Coffee Break)
- [x] Room Creation, Deletion, and Renaming
- [x] Real-time Display of Participant Count and Online Status
- [x] Room Permission Management
- [x] Hoverable Expandable Auto-Collapse Sidebar
- [x] Room Persistence Settings (Data Retention)
- [x] Public Rooms Default Expand Display

**Advanced Room Features**

- [x] Private room approval system and join notification
- [x] Room owner permissions and control
- [x] Host's full permissions over all sub-rooms
- [x] Cross-room screen sharing permissions
- [x] Automatic room cleanup upon exit (non-persistent)
- [x] Specific room user status management
- [x] In-room user track subscription permission control
- [x] Sub-room user isolation and audio filtering

### 🤖 AI Features

**AI Screenshot Analysis and Work Log**

- [x] Automatic screenshots and AI analysis
- [x] Configurable screenshot frequency (1-15 minute interval)
- [x] Multi-data source support (screen sharing, to-do items, time statistics)
- [x] Real-time work log generation and summary
- [x] Export analysis results in Markdown format
- [x] Contextual analysis combined with historical data
- [x] Automatic scheduled updates of analysis results
- [x] Screen sharing permission request and guidance
- [x] Support for AI work log widget display
- [x] Customizable AI prompt word configuration
- [x] Multi-language AI analysis support

**Virtual Characters**

- [x] Live2D virtual character integrated facial tracking
- [x] Real-time facial tracking and animation
- [x] Multiple virtual character model selection
- [x] Customizable background and environment
- [x] Performance optimization and automatic detection
- [x] Seamless virtual character switching with masking effect
- [x] Before and after effect comparison mode
- [x] Virtual character model isolation for each user

**Audio Enhancement**

- [x] AI noise reduction
- [x] Real-time audio processing
- [x] Volume normalization
- [x] Customizable new user joining notification sound

### 🎬 Recording and Media

**Room Recording**

- [x] 4K full-room recording
- [x] Host-initiated recording
- [x] Participant recording requests and approval process
- [x] Real-time recording notifications
- [x] Automatic S3 storage integration
- [x] Download link, valid for 3 days
- [x] Supports mobile recording with permission detection
- [x] Recording management panel

**File Management**

- [x] Drag and drop file sharing in chat
- [x] Image preview and download
- [x] Automatic file organization by room
- [x] Secure file storage and retrieval
- [x] File size and type verification

### 🎮 Built-in Applications

**Productivity Applications**

- [x] To-do list application with task management
- [x] Editable to-do items and completion markers
- [x] To-do item export function (including time records)
- [x] Team Status displays the to-do progress of all members
- [x] Timer app with lap tracking
- [x] Customizable countdown timer
- [x] App floating window and scrollbar support
- [x] Collapsible app widget
- [x] Cross-participant app data sharing
- [x] Individual app sharing
- [x] Quick access via app icon in the upper right corner of the user view

**App Management**

- [x] App permissions controlled by the host
- [x] App data upload and synchronization
- [x] App history tracking
- [x] Personal app sharing controls (public/private)
- [x] App data persistence across sessions
- [x] Automatic upload configuration option
- [x] Per-user app data isolation

### 🔧 Advanced Settings

**Audio Configuration**

- [x] Device selection and switching
- [x] Volume control and testing
- [x] Real-time audio quality adjustment
- [x] Screen sharing audio switching
- [x] Customizable notification sounds

**Video Configuration**

- [x] Camera device management
- [x] GPU-accelerated blur intensity control (0-100%)
- [x] Screen sharing blur settings
- [x] Real-time video quality optimization
- [x] Lossless transmission mode
- [x] Dynamically adjust quality based on network connection

**Virtual Environment**

- [x] Virtual model selection with integrated Live2D
- [x] Background customization
- [x] Performance monitoring and automatic adjustment
- [x] Effect comparison mode
- [x] WebGL accelerated video processing

**System Preferences**

- [x] Multilingual interface (i18n)
- [x] Customizable user status creation and management
- [x] User status linked to to-do items
- [x] Theme and UI customization
- [x] Persistent storage settings in localStorage
- [x] Automatic saving and instant synchronization of settings
- [x] Dynamic global configuration support
- [x] Host configuration with hot reload function

### 🔒 Security and Privacy

**Encryption and Security**

- [x] Supports End-to-End Encryption (E2EE)
- [x] Secure WebRTC Communication
- [x] TURN Server Integration for Connectivity
- [x] Unique Participant ID Generation (ULID-based)
- [x] Session-Based Authentication
- [x] License Certificate Verification System
- [x] Domain and Participant Limit Control
- [x] Temporary and Official Certificate Support

**Permissions and Access Control**

- [x] Device Permission Management
- [x] Detailed Permission Descriptions and Guidelines
- [x] Fine-grained Access Control
- [x] Private Room Approval Process
- [x] Host Permission Management
- [x] Hand-Raising Speaking Permission Control
- [x] Application Data Access Permission Management

### 🏗️ Technical Features

**Performance and Reliability**

- [x] Client Performance Monitoring
- [x] Server-Side Performance Tracking (with Heartbeat)
- [x] WebGL Accelerated Video Processing
- [x] Optimized Codec Selection (VP9/VP8/H264/AV1)
- [x] Automatic Reconnection Mechanism
- [x] Connection Quality Monitoring
- [x] Connection Fallback Option

**Infrastructure**

- [x] Redis-based Data Persistence
- [x] WebSocket Real-time Communication using Socket.IO
- [x] Socket Disconnection Reconnection and Automatic Recovery Mechanism
- [x] Support for Docker Deployment and Containerization
- [x] Integration with S3 for Media Storage
- [x] Custom Express + Next.js Server Architecture
- [x] Support for Horizontal Scaling
- [x] Server Heartbeat Detection and Health Monitoring

**Data Management**

- [x] User Session Management and Unique ID Generation
- [x] Room Status Synchronization and Real-time Updates
- [x] Chat History Persistence
- [x] Application Data Backup and Recovery
- [x] Automatic Data Cleanup and Lifecycle Management
- [x] Persistent Room Data Retention
- [x] User Offline Detection and Cleanup Mechanism

### 📊 Analysis and Monitoring

**Usage Analysis**

- [x] Real-time Active Room Monitoring
- [x] Historical Records, Including Daily/Weekly/Monthly Rankings
- [x] Meeting Duration Sorting and Leaderboard Display
- [x] User Activity Analysis and Leaderboard
- [x] Performance Metrics Dashboard
- [x] Participant Engagement Tracking
- [x] Redis Heartbeat Detection and User Status Synchronization

**Management Tools**

- [x] Management Dashboard with Comprehensive Statistics
- [x] Dashboard Quality Configuration Management
- [x] Real-time Participant Tracking for All Rooms
- [x] Session Duration Monitoring
- [x] Resource Usage Optimization
- [x] Global Configuration Management and Hot Reload
- [x] User Management and Approval Tools
- [x] Host Token Authentication

**Development and Deployment**

- [x] Docker Containerization and One-Click Deployment
- [x] Environment-Based Configuration
- [x] Production/Development Mode Differentiation
- [x] Automated Deployment Scripts (Chinese and English Versions)
- [x] Performance Testing and Load Balancing
- [x] SEO Optimization and Meta Tags
- [x] Multi-Environment Configuration File Support
- [x] Quick Local Deployment Documentation
- [x] Egress Recording Service Integration

For detailed feature specifications and implementation notes, see [FEATURE.md](./log/FEATURE.md) and [TODO.md](./log/TODO.md).

### CHANGELOG

See [CHANGELOG](./log/CHANGELOG.md)
