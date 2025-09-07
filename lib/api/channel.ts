import { connect_endpoint } from '../std';

const CONNECT_ENDPOINT = connect_endpoint('/api/space');

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

export const createRoom = async ({ spaceName, roomName, ownerId, isPrivate }: CreateRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', 'true');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      roomName,
      participantId: ownerId,
      isPrivate,
    } as CreateRoomBody),
  });
};
export interface CreateAtomgitRoomParam extends CreateRoomParam {
  participantIds: string[];
}

export type CreateAtomgitRoomBody = CreateAtomgitRoomParam;

export const createAtomgitRoom = async (params: CreateAtomgitRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('atomgitRoom', 'true');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params as CreateAtomgitRoomBody),
  });
};

export interface DeleteRoomParam extends BasicParam {}

export type DeleteRoomBody = DeleteRoomParam;

export const deleteRoom = async ({ spaceName, roomName }: DeleteRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', ChildRoomMethods.DELETE);
  return await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      roomName,
    } as DeleteRoomBody),
  });
};

export interface LeaveRoomParam extends BasicParam {
  participantId: string;
}

export type LeaveRoomBody = LeaveRoomParam;

export const leaveRoom = async ({ spaceName, roomName, participantId }: LeaveRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', ChildRoomMethods.LEAVE);
  return await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      roomName,
      participantId,
    } as LeaveRoomBody),
  });
};

export interface JoinRoomParam extends BasicParam {
  participantId: string;
}

export type JoinRoomBody = JoinRoomParam;

export const joinRoom = async ({ spaceName, roomName, participantId }: JoinRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', ChildRoomMethods.JOIN);
  return await fetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      roomName,
      participantId,
    } as JoinRoomBody),
  });
};

export type UpdateRoomType = 'name' | 'privacy';

export interface UpdateRoomParam extends BasicParam {
  ty: UpdateRoomType;
  newRoomName?: string;
  isPrivate?: boolean;
}

export type UpdateRoomBody = UpdateRoomParam;

export const updateRoom = async ({
  ty,
  roomName,
  isPrivate,
  spaceName,
  newRoomName,
}: UpdateRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', ChildRoomMethods.UPDATE);
  return await fetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      roomName,
      ty,
      isPrivate,
      newRoomName,
    } as UpdateRoomParam),
  });
};

export enum ChildRoomMethods {
  CREATE = 'create',
  DELETE = 'delete',
  JOIN = 'join',
  LEAVE = 'leave',
  UPDATE = 'update',
}
