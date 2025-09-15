import { createRoom, deleteRoom, joinRoom, leaveRoom, updateRoom } from './channel';
import { fetchLinkPreview, getChatMsg } from './chat';
import { getConf, reloadConf } from './conf';
import { checkLicenseByIP, getLicenseByIP } from './license';
import { sendRecordRequest, updateRecord } from './record';
import {
  allSpaceInfos,
  checkUsername,
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
} from './space';

export const api = {
  // ---- space api --------
  joinSpace,
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
  reloadConf,
};
