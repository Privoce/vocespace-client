import { SupabaseClient } from "@supabase/supabase-js";
import { BucketApiErrMsg } from "../error";

export const FOLDER = "public";
export const AVATAR_BUCKET = "avatars";
export const AI_ANALYSIS_BUCKET = "ai_analysis";

export const createAvatarStoragePath = (
  uid: string,
  fileExt: string
): string => {
  return `${FOLDER}/${uid}_${Date.now()}.${fileExt}`;
};

const update = async (client: SupabaseClient, uid: string, file: File) => {
  const fileExt = file.name.split(".").pop();
  if (!fileExt) {
    throw new Error(BucketApiErrMsg.FILE_NO_EXT);
  }
  const filePath = createAvatarStoragePath(uid, fileExt);
  const { data, error } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });
  if (error) {
    throw error;
  }

  return data.path;
};

const url = async (client: SupabaseClient, path: string) => {
  const {
    data: { publicUrl },
  } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return publicUrl;
};

const removeAvatar = async (
  client: SupabaseClient,
  path: string
): Promise<boolean> => {
  const { data, error } = await client.storage
    .from(AVATAR_BUCKET)
    .remove([path]);
  if (error) throw error;
  return true;
};

/**
 * 删除用户在storage中的所有文件，这些文件有个特点就是都是以用户的id开头的
 */
const removeAll = async (
  client: SupabaseClient,
  uid: string
): Promise<boolean> => {
  // 目前只需要删掉头像文件和AI总结的图片文件
  const { data: avatarFiles, error: avatarError } = await client.storage
    .from(AVATAR_BUCKET)
    .list(FOLDER, {
      search: `${uid}_`,
    });
  if (avatarError) {
    throw avatarError;
  }
  if (avatarFiles && avatarFiles.length > 0) {
    const avatarPaths = avatarFiles.map((file) => `${FOLDER}/${file.name}`);
    const { error: removeAvatarError } = await client.storage
      .from(AVATAR_BUCKET)
      .remove(avatarPaths);
    if (removeAvatarError) {
      throw removeAvatarError;
    }
  }

  const { data: aiFiles, error: aiError } = await client.storage
    .from(AI_ANALYSIS_BUCKET)
    .list(FOLDER, {
      search: `${uid}_`,
    });
  if (aiError) {
    throw aiError;
  }
  if (aiFiles && aiFiles.length > 0) {
    const aiPaths = aiFiles.map((file) => `${FOLDER}/${file.name}`);
    const { error: removeAiError } = await client.storage
      .from(AI_ANALYSIS_BUCKET)
      .remove(aiPaths);
    if (removeAiError) {
      throw removeAiError;
    }
  }

  return true;
};
/**
 * 将blob图片上传到supabase存储中
 * @param blobImg
 */
const uploadBlob = async (
  client: SupabaseClient,
  blobImg: Blob,
  name: string
) => {
  const { data, error } = await client.storage
    .from(AI_ANALYSIS_BUCKET)
    .upload(`${FOLDER}/${name}`, blobImg, {
      cacheControl: "3600",
      upsert: true,
    });
  if (error) {
    throw error;
  }

  return data.path;
};

/**
 * 将Buffer图片上传到supabase存储中（服务端使用）
 * @param imgBuffer
 * @param name
 */
const uploadBuffer = async (
  client: SupabaseClient,
  imgBuffer: Buffer,
  name: string
) => {
  const { data, error } = await client.storage
    .from(AI_ANALYSIS_BUCKET)
    .upload(`${FOLDER}/${name}`, imgBuffer, {
      cacheControl: "3600",
      upsert: true,
      contentType: "image/jpeg",
    });
  if (error) {
    throw error;
  }

  return data.path;
};

const getUrl = (client: SupabaseClient, bucket: string, path: string) => {
  return client.storage.from(bucket).getPublicUrl(path);
};

export const storage = {
  update,
  url,
  removeAvatar,
  uploadBlob,
  uploadBuffer,
  removeAll,
  getUrl,
};
