import { fetchEnvConf, reloadConf } from './env';
import { joinRoom } from './room';

const api = {
  envConf: fetchEnvConf,
  reloadConf,
  joinRoom
};

export default api;
