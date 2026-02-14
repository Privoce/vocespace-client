/**
 * 图片模糊处理工具
 * 使用 sharp 库对 base64 图片进行模糊处理
 */
import sharp from 'sharp';

/**
 * 对 base64 图片进行模糊处理
 * @param base64Image - base64 格式的图片数据（包含 data:image/xxx;base64, 前缀）
 * @param blurLevel - 模糊度，范围 0-1，0 表示不模糊，1 表示最大模糊
 * @returns 模糊后的 base64 图片
 */
export async function blurBase64Image(
  base64Image: string,
  blurLevel: number,
): Promise<string> {
  // 如果模糊度为 0 或未设置，直接返回原图
  if (!blurLevel || blurLevel <= 0) {
    return base64Image;
  }

  // 确保模糊度在 0-1 范围内
  const normalizedBlur = Math.max(0, Math.min(1, blurLevel));

  try {
    // 提取 base64 数据和格式
    const matches = base64Image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image format');
    }

    const imageFormat = matches[1]; // png, jpeg, webp 等
    const base64Data = matches[2];

    // 将 base64 转换为 Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 计算模糊半径 (1-100 范围，根据模糊度线性映射)
    // sharp 的模糊值通常在 0.3 到 100 之间效果较好
    const blurRadius = 0.3 + normalizedBlur * 99.7;

    // 使用 sharp 进行模糊处理
    const blurredBuffer = await sharp(imageBuffer)
      .blur(blurRadius)
      .toBuffer();

    // 转换回 base64
    const blurredBase64 = blurredBuffer.toString('base64');

    // 返回完整的 base64 字符串（包含前缀）
    return `data:image/${imageFormat};base64,${blurredBase64}`;
  } catch (error) {
    console.error('图片模糊处理失败:', error);
    // 如果处理失败，返回原图
    return base64Image;
  }
}
