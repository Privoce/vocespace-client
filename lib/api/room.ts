import { connect_endpoint, Role } from '../std';

export const joinRoom = async (roomName: string, username: string, region?: string) => {
  const url = new URL(connect_endpoint('/api/connection-details'), window.location.origin);
  url.searchParams.append('roomName', roomName);
  url.searchParams.append('participantName', username);
  if (region) {
    url.searchParams.append('region', region);
  }
  const response = await fetch(url.toString());
  return await response.json();
};

export const getUniqueUsername = async (roomName: string, role: Role): Promise<Response> => {
  const url = new URL(connect_endpoint('/api/room-settings'), window.location.origin);
  url.searchParams.append('roomId', roomName);
  url.searchParams.append('pre', 'true');
  url.searchParams.append('role', role);
  return await fetch(url.toString());
};

export const checkUsername = async (roomName: string, username: string): Promise<Response> => {
  const url = new URL(connect_endpoint('/api/room-settings'), window.location.origin);
  url.searchParams.append('nameCheck', 'true');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: roomName,
      participantName: username,
    }),
  });
};
