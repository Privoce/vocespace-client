import { SupabaseClient, User } from "@supabase/supabase-js";

export const get = async (
  client: SupabaseClient,
  uid: string
): Promise<User> => {
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();

  if (error) throw error;

  return data;
};

export const user = {
    get
}