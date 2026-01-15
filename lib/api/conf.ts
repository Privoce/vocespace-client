import { connect_endpoint } from '../std';
import { RTCConf } from '../std/conf';
import { AIConf } from '../std/conf';

const CONF_API_URL = connect_endpoint('/api/conf');
export const getConf = async (hostToken?: string) => {
  const url = new URL(CONF_API_URL, window.location.origin);
  if (hostToken) {
    url.searchParams.append('hostToken', hostToken);
  }
  return await fetch(url.toString());
};

export const checkHostToken = async (hostToken: string) => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('check', 'true');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hostToken }),
  });
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
  url.searchParams.append('license', 'true');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ license }),
  });
};

export const updateAIConf = async (aiConf: AIConf): Promise<Response> => {
  const url = new URL(CONF_API_URL, window.location.origin);
  url.searchParams.append('ai', 'true');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ aiConf }),
  });
};
