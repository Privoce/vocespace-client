import { atom } from "recoil";
import { createClient } from "@/lib/supabase/client";

// 移除 sb_client atom，直接使用 createClient() 函数调用
// export const sb_client = atom({
//   key: "sb_client",
//   default: createClient(),
// });

// 创建其他需要的atoms
export const userAtom = atom({
  key: "userAtom",
  default: null,
});