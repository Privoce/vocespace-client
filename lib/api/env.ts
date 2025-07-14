import { connect_endpoint } from '../std';
import { DEFAULT_VOCESPACE_CONFIG, VocespaceConfig } from '../std/conf';
import { EnvConf } from '../std/env';

export const fetchEnvConf = async (): Promise<VocespaceConfig> => {
  const url = new URL(connect_endpoint('/api/env'), window.location.origin);
  const response = await fetch(url.toString());
  if (!response.ok) {
    return DEFAULT_VOCESPACE_CONFIG;
  } else {
    return (await response.json()) as VocespaceConfig;
  }
};

export const reloadConf = async (env: EnvConf): Promise<Response> => {
  const url = new URL(connect_endpoint('/api/env'), window.location.origin);
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(env),
  });
};
