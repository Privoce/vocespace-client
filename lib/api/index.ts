import { fetchEnvConf, reloadConf } from './env';
import { checkUsername, getUniqueUsername, joinRoom } from './room';

const api = {
  envConf: fetchEnvConf,
  reloadConf,
  joinRoom,
  getUniqueUsername,
  checkUsername
};

export default api;
