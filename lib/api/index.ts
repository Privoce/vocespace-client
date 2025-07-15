import { fetchEnvConf, reloadConf } from './env';
import { checkUsername, clearDb, getUniqueUsername, joinRoom } from './room';

const api = {
  envConf: fetchEnvConf,
  reloadConf,
  joinRoom,
  getUniqueUsername,
  checkUsername,
  clearDb
};

export default api;
