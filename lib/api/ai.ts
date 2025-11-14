import { Extraction } from '../ai/analysis';
import { CutScreenShot } from '../ai/cut';
import { connect_endpoint } from '../std';

export interface AnalysisRequestBody {
  spaceName: string;
  userId: string;
  screenShot: CutScreenShot;
  todos: string[];
  freq: number;
  lang: string;
  extraction: Extraction;
}

const BASE_URL = connect_endpoint('/api/ai');

/**
 * 开启AI分析
 * @param spaceName
 * @param userId
 * @param screenShot
 * @param todos: 用户的待办事项列表，AI可以依靠这些待办事项来生成更符合用户需求的分析结果
 * @returns
 */
const analysis = async (params: AnalysisRequestBody) => {
  const url = new URL(BASE_URL, window.location.origin);
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
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

/**
 * 下载markdown报告，但这个借口实际上是获取markdown内容
 * 下载函数使用`analysis::downloadMarkdown()`进行下载
 * 这里的名字主要是为了让使用者能够理解这个接口的作用
 * @param spaceName
 * @param userId
 * @returns
 */
const downloadMarkdown = async (spaceName: string, userId: string) => {
  return await unifiedGet(spaceName, userId, 'md');
};

/**
 * 获取用户的分析结果，这个接口会返回最终的分析结果，包括总结和markdown报告
 * 如果用户没有点击获取总结报告这个按钮，markdown内容是不会产生的
 * 所以业务接口中需要根据实际情况判断使用markdown字段还是lines来展示内容
 * @param spaceName
 * @param userId
 * @returns `{res: AICutAnalysisRes}`
 */
const getAnalysisRes = async (spaceName: string, userId: string) => {
  return await unifiedGet(spaceName, userId, 'result');
};

const unifiedGet = async (
  spaceName: string,
  userId: string,
  action: 'stop' | 'md' | 'result',
): Promise<any> => {
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
  getAnalysisRes,
};
