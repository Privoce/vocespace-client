import { ai } from './ai';
import { createRoom, deleteRoom, joinRoom, leaveRoom, updateRoom } from './channel';
import { fetchLinkPreview, getChatMsg, uploadFile } from './chat';
import { checkHostToken, getConf, reloadConf, reloadLicense, updateAIConf } from './conf';
import { checkLicenseByIP, getLicenseByIP } from './license';
import { sendRecordRequest, updateRecord } from './record';
import {
  allSpaceInfos,
  checkUsername,
  createSpace,
  defineUserStatus,
  deleteSpaceParticipant,
  getSpaceInfo,
  getUniqueUsername,
  historySpaceInfos,
  joinSpace,
  leaveSpace,
  persistentSpace,
  updateOwnerId,
  updateSpaceAppAuth,
  updateSpaceApps,
  updateSpaceAppSync,
  updateSpaceParticipant,
  uploadSpaceApp,
  getUserMeta,
  updateSpaceInfo,
  deleteTodo,
  allowGuest,
  transOrSetOwnerManager
} from './space';

export const api = {
  // ---- space api --------
  joinSpace,
  updateSpaceInfo,
  createSpace,
  allSpaceInfos,
  historySpaceInfos,
  getUniqueUsername,
  checkUsername,
  defineUserStatus,
  getSpaceInfo,
  updateOwnerId,
  deleteSpaceParticipant,
  updateSpaceParticipant,
  updateSpaceApps,
  leaveSpace,
  persistentSpace,
  allowGuest,
  uploadSpaceApp,
  updateSpaceAppSync,
  updateSpaceAppAuth,
  deleteTodo,
  transOrSetOwnerManager,
  checkHostToken,
  // ---- chat api --------
  fetchLinkPreview,
  getChatMsg,
  uploadFile,
  // ---- license api --------
  getLicenseByIP,
  checkLicenseByIP,
  // ---- recording api --------
  sendRecordRequest,
  updateRecord,
  // ---- channel api --------
  createRoom,
  deleteRoom,
  leaveRoom,
  joinRoom,
  updateRoom,
  getConf,
  updateAIConf,
  reloadConf,
  reloadLicense,
  // ---- platform api --------
  getUserMeta,
  ai
};
