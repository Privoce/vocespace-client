import { connect_endpoint } from '../std';

export const joinRoom = async (
  roomName: string,
  username: string,
  region?: string,
) => {
  const url = new URL(connect_endpoint('/api/connection-details'), window.location.origin);
  url.searchParams.append('roomName', roomName);
  url.searchParams.append('participantName', username);
  if (region) {
    url.searchParams.append('region', region);
  }
  const response = await fetch(url.toString());
  return await response.json();
};
