import { AICutAnalysis } from "@/lib/std/ai";
import { SupabaseClient } from "@supabase/supabase-js";
import { AI_ANALYSIS_BUCKET } from "./storage";



/**
 * 获取某人某日的AI分析结果
 * @param client
 * @param uid
 * @param date
 * @returns
 */
export const get = async (
  client: SupabaseClient,
  uid: string,
  date: string
): Promise<AICutAnalysis | null> => {
  const { data, error } = await client
    .from(AI_ANALYSIS_BUCKET)
    .select("*")
    .eq("id", uid)
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;

  return data;
};

export const getAll = async (
  client: SupabaseClient,
  uid: string
): Promise<AICutAnalysis[]> => {
  const { data, error } = await client
    .from(AI_ANALYSIS_BUCKET)
    .select("*")
    .eq("id", uid);

  if (error) throw error;

  return data;
};

export const update = async (client: SupabaseClient, data: AICutAnalysis) => {
  const { error } = await client
    .from(AI_ANALYSIS_BUCKET)
    .update(data)
    .eq("id", data.id)
    .eq("date", data.date);

  if (error) {
    throw error;
  }
  return true;
};

/**
 * 插入当天的AI分析结果，如果已存在则合并更新
 */
export const insertOrUpdate = async (
  client: SupabaseClient,
  data: AICutAnalysis
): Promise<boolean> => {
  // 首先检查当天是否已有记录
  const { id, date } = data;
  const today = await get(client, id, date).catch(() => null);
  
  if (today) {
    // 已有记录，进行合并更新
    data.result.forEach((newLine) => {
      const existingIndex = today.result.findIndex(
        (line) => line.timestamp === newLine.timestamp
      );
      
      if (existingIndex !== -1) {
        // 相同时间戳，覆盖
        today.result[existingIndex] = newLine;
      } else {
        // 不同时间戳，追加
        today.result.push(newLine);
      }
    });
    
    // 使用合并后的 today 数据进行更新
    return await update(client, today);
  } else {
    // 无记录，进行插入
    const { error } = await client.from(AI_ANALYSIS_BUCKET).insert(data);

    if (error) {
      throw error;
    }
    return true;
  }
};

const removeAll = async (
  client: SupabaseClient,
  uid: string
): Promise<boolean> => {
  const { error } = await client
    .from(AI_ANALYSIS_BUCKET)
    .delete()
    .eq("id", uid);

  if (error) {
    throw error;
  }
  return true;
};

export const ai = {
  get,
  getAll,
  insertOrUpdate,
  update,
  removeAll,
};
