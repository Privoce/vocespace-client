import { CutScreenShot } from '../ai/cut';
import { connect_endpoint } from '../std';

export interface AnalysisRequestBody {
  spaceName: string;
  userId: string;
  screenShot: CutScreenShot;
}

const BASE_URL = connect_endpoint('/api/ai');

const analysis = async (spaceName: string, userId: string, screenShot: CutScreenShot) => {
  const url = new URL(BASE_URL, window.location.origin);
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spaceName,
      userId,
      screenShot,
    } as AnalysisRequestBody),
  });
};

/**
 * 停止AI分析
 * @param spaceName
 * @param userId
 */
const stop = async (spaceName: string, userId: string) => {
  return await unifiedGet(spaceName, userId, 'stop');
};

const downloadMarkdown = async (spaceName: string, userId: string) => {
  return await unifiedGet(spaceName, userId, 'md');
};

const unifiedGet = async (spaceName: string, userId: string, action: 'stop' | 'md') => {
  const url = new URL(BASE_URL, window.location.origin);
  url.searchParams.append('action', action);
  url.searchParams.append('spaceName', spaceName);
  url.searchParams.append('userId', userId);
  return await fetch(url.toString());
};

export const ai = {
  analysis,
  stop,
  downloadMarkdown,
};
