import dayjs from 'dayjs';
import { AICutAnalysisRes, AICutAnalysisResLine } from '../ai/analysis';
import { SpaceTodo, todayTimeStamp, TodoItem } from '../std/space';

const PLATFORM_URL = 'https://home.vocespace.com/api';
// const PLATFORM_URL = 'http://localhost:3001/api';

export interface PlatformTodos {
  /**
   * user id
   */
  id: string;
  /**
   * jsonb array of todo items
   */
  items: TodoItem[];
  /**
   * timestamp of items
   */
  date: string;
}

const castToPlatformTodo = (todos: SpaceTodo, uid: string): PlatformTodos => {
  return {
    id: uid,
    items: todos.items,
    date: todayTimeStamp(todos.date).toString(),
  };
};
/**
 * 向平台端更新todo数据
 * @param uid 用户id
 * @param todos 待办事项数据
 * @returns
 */
const updateTodo = async (uid: string, todos: SpaceTodo) => {
  // 这里我们需要对todos中的timestamp字段进行处理，修改为date字段，并且需要改为当天00:00:00的时间戳
  const platformTodo = castToPlatformTodo(todos, uid);
  const url = new URL(PLATFORM_URL + '/todos');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      todo: platformTodo,
    }),
  });
};

/**
 * 获取平台端的todo数据 获取所有todo数据
 */
const getTodos = async (uid: string) => {
  const url = new URL(PLATFORM_URL + '/todos');
  url.searchParams.append('uid', uid);
  return await fetch(url.toString());
};

const getAIAnalysis = async (uid: string, date: number) => {
  const url = new URL(PLATFORM_URL + '/ai');
  url.searchParams.append('uid', uid);
  url.searchParams.append('date', date.toString());
  return await fetch(url.toString());
};

/**
 * 向平台端更新AI分析数据
 * 这个接口只能在server端调用，客户端每次请求分析完后调用此接口进行数据存储
 * 客户端需要传递isAuth=true的header以证明身份(客户端localStorage中能够获取到KEY)
 * @param uid 用户id
 * @param screenShot 截图数据 (只有是个新分析结果时才会上传否则为undefined，意味着平台端不需要更新截图)
 * @param data AI分析结果数据
 */
const updateAIAnalysis = async (
  uid: string,
  timestamp: number,
  data: AICutAnalysisRes,
  screenShot?: string,
) => {
  const url = new URL(PLATFORM_URL + '/ai');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: uid,
      timestamp,
      data: {
        screenShot,
        result: data,
      },
    }),
  });
};

export interface PlatformTodos {
  id: string;
  items: TodoItem[];
  date: string;
}

export interface PlarformAICutAnalysis {
  /**
   * user auth id
   */
  id: string;
  /**
   * 时间戳，用户区分每天的分析结果，使用当天00:00:00的时间戳显示
   */
  date: string;
  /**
   * jsonb 存储AICutAnalysisRes结果
   */
  result: AICutAnalysisResLine[]; // JSON.stringify(AICutAnalysisResLine[])
}

export const convertPlatformToACARes = (platform: PlarformAICutAnalysis): AICutAnalysisRes => {
  return {
    markdown: '',
    summary: '',
    lines: platform?.result || [],
  };
};

const isAuth = async (uid: string): Promise<boolean> => {
  const url = new URL(PLATFORM_URL + '/user');
  url.searchParams.append('uid', uid);
  const res = await fetch(url.toString());
  if (res.ok) {
    const { exist }: { exist: boolean } = await res.json();
    return exist;
  }
  return false;
};

export const platformAPI = {
  todo: {
    updateTodo,
    getTodos,
  },
  ai: {
    getAIAnalysis,
    updateAIAnalysis,
  },
  isAuth,
};
