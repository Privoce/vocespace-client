import { connect_endpoint } from '../std';
import { RTCConf } from '../std/conf';

const CONF_API_URL = connect_endpoint('/api/conf');
export const getConf = async () => {
  const url = new URL(CONF_API_URL, window.location.origin);
  return await fetch(url.toString());
};

export const reloadConf = async (env: RTCConf): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(env),
  });
};

export const reloadLicense = async (license: string): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('license', "true");
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ license }),
  });
}