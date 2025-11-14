import { SpaceTodo, TodoItem } from '../std/space';

// const PLATFORM_URL = "https://home.vocespace.com/api";
const PLATFORM_URL = 'http://localhost:3001/api';

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
  const date = new Date(todos.timestamp);
  date.setHours(0, 0, 0, 0); // 设置为当天的00:00:00
  return {
    id: uid,
    items: todos.items,
    date: date.getTime().toString(),
  };
};

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

export const platformAPI = {
  todo: {
    updateTodo,
  },
};
