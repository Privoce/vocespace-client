import { fetchEnvConf } from './env';
import { joinRoom } from './room';

const api = {
  envConf: fetchEnvConf,
  joinRoom
};

export default api;
