

export interface BasicParam {
  spaceName: string;
  roomName: string;
}

/**
 *  Create a new room with the given parameters.
 *  @param spaceName - The space (host room) where the new room will be created.
 *  @param roomName - The name of the new room.
 *  @param ownerId - The ID of the user who will own the room.
 *  @param isPrivate - Whether the room is private or not.
 */
export interface CreateRoomParam extends BasicParam {
  ownerId: string;
  isPrivate: boolean;
}

export interface CreateRoomBody {
  spaceName: string;
  roomName: string;
  participantId: string;
  isPrivate: boolean;
}

export interface DeleteRoomParam extends BasicParam {}

export type DeleteRoomBody = DeleteRoomParam;

export interface LeaveRoomParam extends BasicParam {
  participantId: string;
}

export type LeaveRoomBody = LeaveRoomParam;

export interface JoinRoomParam extends BasicParam {
  participantId: string;
}

export type JoinRoomBody = JoinRoomParam;

export type UpdateRoomType = 'name' | 'privacy';

export interface UpdateRoomParam extends BasicParam {
  ty: UpdateRoomType;
  newRoomName?: string;
  isPrivate?: boolean;
}

export type UpdateRoomBody = UpdateRoomParam;

export enum ChildRoomMethods {
  CREATE = 'create',
  DELETE = 'delete',
  JOIN = 'join',
  LEAVE = 'leave',
  UPDATE = 'update',
}
