import { ai } from './ai';
import { createRoom, deleteRoom, joinRoom, leaveRoom, updateRoom } from './channel';
import { fetchLinkPreview, getChatMsg, uploadFile } from './chat';
import { getConf, reloadConf, reloadLicense, updateAIConf } from './conf';
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
  updateSpaceInfo
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
  uploadSpaceApp,
  updateSpaceAppSync,
  updateSpaceAppAuth,
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
