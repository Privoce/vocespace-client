import { SupabaseClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

// Enable UTC plugin for dayjs
dayjs.extend(utc);

export interface SBClientNeeded {
  client: SupabaseClient;
}

export type Nullable<T> = T | null;

/**
 * Get UTC timestamp for the start of today (00:00:00 UTC)
 * This ensures consistent timestamps across different timezones
 */
export const todayTimestamp = (): number => {
  const startOfDay = dayjs.utc().startOf("day");
  return startOfDay.valueOf();
};

export const currentTimestamp = (): number => {
  return dayjs.utc().valueOf();
};

/**
 * Check if a timestamp is within today (UTC)
 */
export const inToday = (timestamp: number): boolean => {
  const todayStart = todayTimestamp();
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  return timestamp >= todayStart && timestamp < tomorrowStart;
};

export const isMobile = (): boolean => {
  if (typeof window === "undefined") return false;
  return /Mobi|Android/i.test(navigator.userAgent);
};

// - 去除首尾空格
// - 查找`-`,`_`,` `等分隔符，形成数组
// - 如果是英语则将数组的每个首字母大写后就是结果
// - 如果是中文则直接连接数组元素作为结果
// ```
//console.warn(createSpaceName("  live_kit-space test  ")); // LKST
// console.warn(createSpaceName("  你好_世界-测试  ")); // 你世测
// console.warn(createSpaceName("singleword")); // S
// console.warn(createSpaceName("  多字节字符测试  ")); // 多
// console.warn(createSpaceName("  mixed_语言-test  ")); // M语T
// console.warn(createSpaceName("中文 交流")); // 中交
// ```
export const createSpaceName = (spaceName: string, limit = 3): string => {
  // 如果字符少于8个就不处理
  if (spaceName.trim().length <= limit) return spaceName.trim();

  const trimmed = spaceName.trim();
  const separators = /[-_\s]+/;
  const parts = trimmed.split(separators).filter((part) => part.length > 0);

  if (parts.length === 1) {
    // 如果没有有效部分，返回spaceName的首字母大写
    return trimmed.slice(0, 1).toUpperCase();
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
};

/**
 * Convert a base64 encoded string to a compressed Blob object
 * Works in browser environment (using canvas)
 * For server-side compression, use convertBase64ToImgServer in API routes
 * @param base64Str Base64 encoded image string (with or without data URI prefix)
 * @param maxSize Maximum size in KB (default 512KB)
 * @returns Compressed image as Blob
 */
export const convertBase64ToImg = async (
  base64Str: string,
  maxSize = 512
): Promise<Blob> => {
  // 浏览器环境：使用 canvas
  return convertBase64ToImgBrowser(base64Str, maxSize);
};

/**
 * 浏览器环境下的图片压缩（使用 canvas）
 */
const convertBase64ToImgBrowser = async (
  base64Str: string,
  maxSize: number
): Promise<Blob> => {
  // 确保有 data URI 前缀
  const dataUri = base64Str.startsWith("data:")
    ? base64Str
    : `data:image/jpeg;base64,${base64Str}`;

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // 设置 canvas 尺寸
      canvas.width = img.width;
      canvas.height = img.height;

      // 绘制图片
      ctx.drawImage(img, 0, 0);

      // 压缩图片
      let quality = 0.9;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }

            const sizeKB = blob.size / 1024;

            // 如果小于目标大小或质量已经很低，返回结果
            if (sizeKB <= maxSize || quality <= 0.1) {
              resolve(blob);
              return;
            }

            // 如果还是太大，降低质量重试
            quality -= 0.1;
            tryCompress();
          },
          "image/jpeg",
          quality
        );
      };

      tryCompress();
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = dataUri;
  });
};
