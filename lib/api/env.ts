import { connect_endpoint } from '../std';
import { DEFAULT_VOCESPACE_CONFIG, VocespaceConfig } from '../std/conf';

export const fetchEnvConf = async (): Promise<VocespaceConfig> => {
  const url = new URL(connect_endpoint('/api/env'), window.location.origin);
  const response = await fetch(url.toString());
  if (!response.ok) {
    return DEFAULT_VOCESPACE_CONFIG;
  } else {
    return await response.json() as VocespaceConfig;
  }
};
