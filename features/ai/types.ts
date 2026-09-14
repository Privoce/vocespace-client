
export type Extraction = 'easy' | 'medium' | 'max';


/**
 * AI 对单个裁剪的图片进行分析的结果
 * AI应该对一张图片返回一个AICutAnalysisResLine的结构体
 * 将图片当作用户的一次任务进行处理
 */
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
 * AI 返回的原始结果结构体
 */
export interface AICutAnalysisBack {
  timestamp: number;
  name: string;
  content: string;
  /**
   * 与历史任务相似的时间戳，如果与历史任务基本没有变化则返回相似任务的时间戳，否则返回0
   */
  same: number;
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


export const DEFAULT_AI_CUT_ANALYSIS_RES: AICutAnalysisRes = {
  lines: [],
  summary: '',
  markdown: '',
};


export type AICutDeps = 'screen' | 'todo' | 'spent' | 'duration';
