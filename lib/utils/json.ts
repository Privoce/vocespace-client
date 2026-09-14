
/**
 * 返回格式为:
 * ```json
 * ```
 * or
 * ```markdown
 * ```
 * or
 * ```
 * ```
 * @param jsonCode
 */
export const parseJsonBack = (jsonCode: string): string => {
  // 移除开头的代码块标记和可能的换行符
  let result = jsonCode.replace(/^[\s\S]*?```(?:json|markdown)?\s*/, '');
  // 移除结尾的代码块标记和可能的换行符
  result = result.replace(/\s*```[\s\S]*?$/, '');
  // 去除首尾的空白字符
  return result.trim();
};
