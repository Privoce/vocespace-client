import { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_USER_INFO, UserInfo } from "../../std/user";
import { space } from "./space";
import { storage } from "./storage";
import { todos } from "./todo";
import { ai } from "./ai";

export const USER_INFO_API_URL = "/api/user_info";

export const get = async (
  client: SupabaseClient,
  uid: string
): Promise<UserInfo> => {
  const { data, error } = await client
    .from("user_info")
    .select("*")
    .eq("id", uid)
    .single();

  if (error) {
    console.error("API Error:", error);
    throw error;
  }

  return data;
};

/**
 * Get user info by uid, returns null if not found (instead of throwing error)
 */
export const getOrNull = async (
  client: SupabaseClient,
  uid: string
): Promise<UserInfo | null> => {
  const { data, error } = await client
    .from("user_info")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  if (error) {
    console.error("API Error:", error);
    return null;
  }

  return data;
};

export const create = async (
  client: SupabaseClient,
  uid: string,
  username: string
): Promise<UserInfo> => {
  const { data, error } = await client
    .from("user_info")
    .insert(DEFAULT_USER_INFO(uid, username))
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
};

export const insert = async (
  client: SupabaseClient,
  info: UserInfo
): Promise<boolean> => {
  const { data, error } = await client.from("user_info").insert(info).single();

  if (error) {
    throw error;
  }
  return true;
};

export const update = async (
  client: SupabaseClient,
  uid: string,
  info: Partial<UserInfo>
): Promise<boolean> => {
  const { data, error } = await client
    .from("user_info")
    .update(info)
    .eq("id", uid);

  if (error) {
    throw error;
  }
  return true;
};

/**
 * 用户退出登录之后需要把用户状态设置为离线
 */
export const offline = async (
  client: SupabaseClient,
  uid: string
): Promise<boolean> => {
  const { error } = await client
    .from("user_info")
    .update({ online: false })
    .eq("id", uid);

  if (error) {
    throw error;
  }
  return true;
};

/**
 * 用户成功登陆之后需要把用户状态设置为在线
 */
export const online = async (
  client: SupabaseClient,
  uid: string
): Promise<boolean> => {
  const { error } = await client
    .from("user_info")
    .update({ online: true })
    .eq("id", uid);

  if (error) {
    throw error;
  }
  return true;
};

export const remove = async (
  client: SupabaseClient,
  uid: string
): Promise<boolean> => {
  const { data, error } = await client.from("user_info").delete().eq("id", uid);

  if (error) {
    throw error;
  }
  return true;
};

const exist = async (client: SupabaseClient, uid: string): Promise<boolean> => {
  const { data, error } = await client
    .from("user_info")
    .select("id")
    .eq("id", uid)
    .maybeSingle();

  if (error) {
    return false;
  }

  return data !== null;
};

export const userInfo = {
  get,
  getOrNull,
  create,
  insert,
  update,
  remove,
  online,
  offline,
  exist
};
