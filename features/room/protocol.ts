import { Track } from 'livekit-client';
import { ChildRoom, ParticipantHandWriting } from '@/features/spaces/model';
export interface MouseMove {
  space: string;
  x: number;
  y: number;
  name: string;
  color: string;
  timestamp: number;
  realVideoRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}


export interface WsBase {
  space: string; // 房间名
}


export interface WsParticipant extends WsBase {
  participantId: string; // 参与者ID
}


export interface WsTilePlayer extends WsParticipant {
  ty?: 'image' | 'iframe' | 'nestedBrowser' | 'whiteboard';
  created: boolean;
  playerId?: string;
  ownerId?: string;
  action?: 'create' | 'remove' | 'update';
}


export interface WsRemove extends WsBase {
  participants: string[]; // 参与者ID列表
  childRoom: string; // 子房间名
  socketIds: string[]; // 参与者的socket ID列表
}


export interface WsSender extends WsBase {
  senderName: string;
  senderId: string;
  /**
   * 发送者的socket ID (可选)
   * 如果携带此字段，服务器会将消息发送到指定的socket ID，确保消息只发送给特定的连接。
   * 当前用于举手功能，确保主持人与举手者之间的通信
   */
  senderSocketId?: string;
}


export interface WsTo extends WsSender {
  receiverId: string;
  socketId: string;
}


export interface WsWave extends WsTo {
  childRoom?: ChildRoom;
  /**
   * 发送的用户在主空间中
   */
  inSpace?: boolean;
}


export interface WsMouseMove extends MouseMove, WsTo {}


export interface WsMouseClick extends WsTo {}


export interface WsWhiteboardSync extends WsBase {
  senderId: string;
  receiverId: string;
  handWriting: ParticipantHandWriting;
}


export interface WsWhiteboardClearAll extends WsBase {
  senderId: string;
  receiverId: string;
}


export interface WsJoinRoom extends WsTo {
  childRoom: string;
  confirm?: boolean; // 是否确认加入
}


export interface WsInviteDevice extends WsTo {
  device: Track.Source;
  isOpen: boolean;
}


export enum ControlType {
  ChangeName = 'change_name',
  MuteAudio = 'mute_audio',
  MuteVideo = 'mute_video',
  MuteScreen = 'mute_screen',
  Volume = 'volume',
  BlurVideo = 'blur_video',
  BlurScreen = 'blur_screen',
  Transfer = 'transfer',
  setManager = 'set_manager',
}


export interface WsControlParticipant extends WsTo {
  type: ControlType;
  username?: string;
  volume?: number; // 音量调节
  blur?: number; // 视频或屏幕模糊度
}
