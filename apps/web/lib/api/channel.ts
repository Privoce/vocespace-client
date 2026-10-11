import {
  BasicParam,
  CreateRoomParam,
  CreateRoomBody,
  DeleteRoomParam,
  DeleteRoomBody,
  LeaveRoomParam,
  LeaveRoomBody,
  JoinRoomParam,
  JoinRoomBody,
  UpdateRoomType,
  UpdateRoomParam,
  UpdateRoomBody,
  ChildRoomMethods,
} from '@vocespace/domain/requests/channel';
export * from '@vocespace/domain/requests/channel';
import { apiFetch } from '@/lib/api/client';
import { connect_endpoint } from '@/lib/std/index';

const CONNECT_ENDPOINT = connect_endpoint('/api/space');

export const createRoom = async ({ spaceName, roomName, ownerId, isPrivate }: CreateRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', 'true');
  return await apiFetch(url.toString(), {
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

export const deleteRoom = async ({ spaceName, roomName }: DeleteRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', ChildRoomMethods.DELETE);
  return await apiFetch(url.toString(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      roomName,
    } as DeleteRoomBody),
  });
};

export const leaveRoom = async ({ spaceName, roomName, participantId }: LeaveRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', ChildRoomMethods.LEAVE);
  return await apiFetch(url.toString(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      roomName,
      participantId,
    } as LeaveRoomBody),
  });
};

export const joinRoom = async ({ spaceName, roomName, participantId }: JoinRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', ChildRoomMethods.JOIN);
  return await apiFetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      roomName,
      participantId,
    } as JoinRoomBody),
  });
};

export const updateRoom = async ({
  ty,
  roomName,
  isPrivate,
  spaceName,
  newRoomName,
}: UpdateRoomParam) => {
  const url = new URL(CONNECT_ENDPOINT, window.location.origin);
  url.searchParams.append('childRoom', ChildRoomMethods.UPDATE);
  return await apiFetch(url.toString(), {
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
