import { dbApi } from "./db";
import { vocespace } from "./vocespace/space";
import { todos } from "./vocespace/todo";

export const api = {
  userInfo: dbApi.userInfo,
  todos,
  /**
   * only for server side
   */
  vocespace,
};
