import { connect_endpoint } from '../std';
import { ChildRoom } from '../std/room';

const CONNECT_ENDPOINT = connect_endpoint('/api/room-settings');

export interface BasicParam {
  hostRoom: string;
  roomName: string;
}
/**
 *  Create a new room with the given parameters.
 *  @param hostRoom - The space (host room) where the new room will be created.
 *  @param roomName - The name of the new room.
 *  @param ownerId - The ID of the user who will own the room.
 *  @param isPrivate - Whether the room is private or not.
 */
export interface CreateRoomParam extends BasicParam {
  ownerId: string;
  isPrivate: boolean;
}

export const createRoom = async ({ hostRoom, roomName, ownerId, isPrivate }: CreateRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', 'true');

  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: hostRoom,
      childRoomName: roomName,
      participantId: ownerId,
      isPrivate,
    }),
  });
};

export interface DeleteRoomParam extends BasicParam {}

export const deleteRoom = async ({ hostRoom, roomName }: DeleteRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', 'true');
  url.searchParams.append('delete', 'true');
  return await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: hostRoom,
      childRoom: roomName,
    }),
  });
};

export interface LeaveRoomParam extends BasicParam {
  participantId: string;
}

export const leaveRoom = async ({ hostRoom, roomName, participantId }: LeaveRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', 'true');
  url.searchParams.append('leave', 'true');
  return await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: hostRoom,
      childRoom: roomName,
      participantId,
    }),
  });
};

export interface JoinRoomParam extends BasicParam {
  participantId: string;
}

export const joinRoom = async ({ hostRoom, roomName, participantId }: JoinRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  return await fetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: hostRoom,
      childRoom: roomName,
      participantId,
    }),
  });
};

export type UpdateRoomType = 'name' | 'privacy';

export interface UpdateRoomParam extends BasicParam {
  ty: UpdateRoomType;
  newRoomName?: string;
  isPrivate?: boolean;
}

export const updateRoom = async ({
  ty,
  roomName,
  isPrivate,
  hostRoom,
  newRoomName,
}: UpdateRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('updateChildRoom', 'true');
  return await fetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: hostRoom,
      childRoom: roomName,
      ty,
      isPrivate,
      newRoomName,
    }),
  });
};
