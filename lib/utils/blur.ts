import type { SizeNum } from '@/lib/types/common';
/// 计算视频模糊度
/// video_blur是视频模糊度, size是视频大小, 需要根据size来计算相对模糊度
/// 对于传入的video_blur的范围是0.0 ~ 1.0, 0.0表示不模糊, 1.0表示最大模糊
/// 返回基于标准化尺寸的模糊度(px)，确保在不同窗口大小下效果一致
/// 计算方式：采用相对于448 x 224的比例来计算模糊值
export function count_video_blur(video_blur: number, size: SizeNum): number {
  const { width, height } = size;
  const minSide = Math.max(width, height);
  const blurRadius = video_blur * minSide * 0.05;

  return blurRadius;
}
