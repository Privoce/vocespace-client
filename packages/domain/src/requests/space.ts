import type { UserDefineStatus, IdentityType, AuthType, RoomType } from '../model';
import type {
  RecordSettings,
  SpaceTimer,
  SpaceCountdown,
  SpaceTodo,
  AllowGuest,
  AppKey,
  AppAuth,
  ParticipantSettings,
  SpaceRBACConf,
  SpaceAuthConf,
  SpaceAIConf,
  SpaceWorkConf,
} from '../space';

export interface CheckNameBody {
  spaceName: string;
  participantName: string;
  participantId?: string;
}

export interface DefineUserStatusBody {
  spaceName: string;
  participantId: string;
  status: string;
}

export interface DefineUserStatusResponse {
  success: boolean;
  spaceName?: string;
  error?: any;
}

export interface UpdateOwnerIdBody {
  spaceName: string;
  participantId: string;
}

export interface DeleteSpaceParticipantBody {
  spaceName: string;
  participantId: string;
}

export interface UpdateSpaceParticipantBody {
  spaceName: string;
  participantId: string;
  settings: ParticipantSettings;
  record?: RecordSettings;
  init?: boolean;
}

export interface TransOrSetOMBody {
  spaceName: string;
  participantId: string;
  replacedId: string;
  isTransfer: boolean;
}

export interface UpdateSpaceAppsBody {
  spaceName: string;
  appKey: AppKey;
  enabled: boolean;
}

export interface UpdateSpaceAppSyncBody {
  spaceName: string;
  participantId: string;
  sync: AppKey;
}

export interface UpdateSpaceAppAuthBody {
  spaceName: string;
  participantId: string;
  appAuth: AppAuth;
}

export interface PersistentSpaceBody {
  spaceName: string;
  persistence: boolean;
}

export interface AllowGuestBody {
  spaceName: string;
  allowGuest: AllowGuest;
}

export interface UploadSpaceAppBody {
  spaceName: string;
  participantId: string;
  data: SpaceTimer | SpaceCountdown | SpaceTodo;
  ty: AppKey;
  isAuth: boolean;
  deleteId?: string;
}

export interface WorkModeBody {
  spaceName: string;
  participantId: string;
  workType: boolean;
}

export interface EnterRoomBody {
  space: string;
  auth: AuthType;
  uid: string;
  room?: RoomType;
  identity?: IdentityType;
  username: string;
}

export interface UpdateAuthRBACConfBody {
  spaceName: string;
  authConf: SpaceAuthConf;
}
