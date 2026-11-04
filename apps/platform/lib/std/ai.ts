import { todayTimestamp } from ".";

export interface AICutAnalysisResLine {
  /**
   * 当前用户进行任务的时间戳，由外部传入
   */
  timestamp: number;
  /**
   * 分析图片的任务名称
   */
  name: string;
  /**
   * 详细描述用户任务的内容
   */
  content: string;
  /**
   * 花费的时间统计，单位分钟，当结果解析出含有same字段时需要处理
   */
  duration: number;
  /**
   * 与历史任务相似的时间戳，当AICutAnalysisBack.same字段不为0时会将本次的timestamp作为相似任务的时间戳
   * 这样就可以获取了第二张图片的时间戳信息了
   */
  same?: number;
}
/**
 * 最终的AI裁剪分析结果，包含多行结果，形成完整的分析报告(任务总结)
 */
export interface AICutAnalysisRes {
  lines: AICutAnalysisResLine[];
  /**
   * 任务总结
   */
  summary: string;
  /**
   * 整理形成的markdown格式的输出
   */
  markdown: string;
}

/**
 * AI裁剪分析结果存储结构
 */
export interface AICutAnalysis {
  /**
   * user auth id
   */
  id: string;
  /**
   * 时间戳，用户区分每天的分析结果，使用当天00:00:00的时间戳显示
   */
  date: string;
  /**
   * jsonb 存储AICutAnalysisRes结果
   */
  result: AICutAnalysisResLine[]; // JSON.stringify(AICutAnalysisResLine[])
}

export const DEFAULT_AI_CUT_ANALYSIS: AICutAnalysis = {
  id: "",
  date: todayTimestamp().toString(),
  result: [],
}