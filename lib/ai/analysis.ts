import { content } from 'html2canvas/dist/types/css/property-descriptors/content';
import { AICutService, CutScreenShot } from './cut';
import { OpenAI } from 'openai';

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

export type AICutDeps = 'screen' | 'todo' | 'spent';

/**
 * 由于AI需要进行图片分析，所以用户需要选择使用多模态AI模型
 * 模型推荐：
 * | 模型名称                           | 所属公司      | 支持模态        | 主要特点                    |
 * | --------------------------------- | --------- | ----------- | ----------------------- |
 * | GPT-4V / GPT-4o                   | OpenAI    | 文本、图像、音频    | 综合能力强，图像理解和文本生成表现优异     |
 * | Claude 3.5 Sonnet                 | Anthropic | 文本、图像       | 编程与推理能力强，适用于逻辑性图像任务     |
 * | Gemini 1.5 Pro / Gemini 2.0 Flash | Google    | 文本、图像、音频、视频 | 支持长视频理解，多媒体处理能力强        |
 * | Qwen2.5-VL-72B                    | 阿里巴巴      | 文本、图像、视频    | 中文理解能力强，视觉问答表现突出        |
 * | 文心一言多模态版                     | 百度        | 文本、图像、语音    | 中文本土化优化，适合中文多媒体内容处理     |
 * | 混元Vision                         | 腾讯        | 文本、图像       | 中文任务优化，SuperCLUE-V测评中领先 |
 */
export class AICutAnalysisService {
  // 静态常量配置
  private static readonly DEFAULT_MAX_TOKENS = 4000;

  private static readonly PROMPT_TEMPLATES = {
    LINE: '作为一个个人工作汇总整理助理，请将我提供的截图内容进行分析，提取出其中的主要任务和活动，请根据截图的内容与历史数据，识别出我在该时间点所进行的具体任务，并生成一个结构化的报告。报告应包括以下内容：1. 任务名称：简洁明了地描述我正在进行的任务。2. 任务内容：详细说明任务的具体内容和目的。3. 比较历史分析数据，如果发现当前任务和历史任务基本没有变化，在返回时将timestamp使用历史任务的时间戳，并将name和content设置为空字符串即可。请确保报告条理清晰，便于理解和后续参考。整理形成如下格式进行输出: {timestamp: number, name: string, content: string}，只返回json，不要包含其他多余描述。',

    ALL: '作为一个个人工作汇总整理助理, 请将我提供的json数组内容整理分析，提取出其中的主要任务和活动。请根据每个时间点的任务内容，识别出用户在整个时间段内所进行的具体任务，并生成一个结构化的总结报告。报告应包括以下内容：1. 任务总结：概括用户在该时间段内完成的主要任务和活动。2. 关键点提取：突出显示每个任务的关键要素和成果。3. Markdown格式输出：将总结报告整理成Markdown格式，便于阅读和分享。请确保报告条理清晰，便于理解和后续参考。格式如下进行输出：{summary: string; markdown: string} ，只返回json，不要包含其他多余描述。',
  };

  private readonly MODEL: string;
  private readonly MAX_TOKEN: number;
  private OPENAI: OpenAI;

  public result: AICutAnalysisRes;

  constructor(apiKey: string, apiUrl: string, modal: string) {
    this.OPENAI = new OpenAI({
      apiKey,
      baseURL: apiUrl,
    });
    this.MODEL = modal;
    this.MAX_TOKEN = AICutAnalysisService.DEFAULT_MAX_TOKENS;
    this.result = this.createEmptyResult();
  }

  /**
   * 创建空的分析结果对象
   * @returns 初始化的分析结果
   */
  private createEmptyResult(): AICutAnalysisRes {
    return {
      lines: [],
      summary: '',
      markdown: '',
    };
  }

  /**
   * 通用的AI API请求方法
   * @param messages 消息内容
   * @param requestType 请求类型，用于错误日志
   * @returns API响应数据
   */
  private async makeAIRequest(messages: any[]): Promise<OpenAI.Chat.ChatCompletion> {
    const completion = await this.OPENAI.chat.completions.create({
      model: this.MODEL,
      messages,
      stream: false,
    });

    return completion;
  }

  /**
   * 构建单张图片分析的消息内容
   * @param tg 截图数据
   * @returns 消息数组
   */
  private buildImageAnalysisMessage(tg: CutScreenShot, todos: string[]): any[] {
    return [
      {
        role: 'system',
        content: AICutAnalysisService.PROMPT_TEMPLATES.LINE,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: tg.data,
            },
          },
          // 历史任务数据辅助分析
          ...(this.result.lines.length > 0
            ? [
                {
                  type: 'text',
                  text: `此外，以下是我之前的任务分析数据：${JSON.stringify(this.result.lines)}`,
                },
              ]
            : []),
          ...(tg.showTime
            ? [
                {
                  type: 'text',
                  text: `请对该任务markdown格式的标题后增加时间标记，格式为(${new Date(
                    tg.timestamp,
                  ).toLocaleTimeString()})`,
                },
              ]
            : []),
          ...(todos.length > 0
            ? [
                {
                  type: 'text',
                  text: `此外，当前我的待办事项有：${todos.join(
                    '，',
                  )}，你可以结合这些待办事项来分析这张截图内容。`,
                },
              ]
            : []),
        ],
      },
    ];
  }

  /**
   * 构建总结分析的消息内容
   * @returns 消息数组
   */
  private buildSummaryMessage(): any[] {
    return [
      {
        role: 'system',
        content: AICutAnalysisService.PROMPT_TEMPLATES.ALL,
      },
      {
        role: 'user',
        content: JSON.stringify(this.result.lines),
      },
    ];
  }

  /**
   * 调用AI服务对单张图片进行分析
   * @param tg 截图数据
   */
  async doAnalysisLine(tg: CutScreenShot, todos: string[]): Promise<void> {
    const messages = this.buildImageAnalysisMessage(tg, todos);
    const data = await this.makeAIRequest(messages);
    const content = data.choices?.[0]?.message?.content;
    console.warn(content);
    if (!!content) {
      const line = JSON.parse(parseJsonBack(content)) as AICutAnalysisResLine;
      // 判断是否和历史数据重复

      if (line.name === '' && line.content === '') {
        // 遍历历史数据找到时间戳相同的
        // for (const historyLine of this.result.lines) {
        //   if (historyLine.timestamp === line.timestamp) {
        //     repeat = true;
        //     break;
        //   }
        // }
        return;
      }

      this.result.lines.push(line);
    }
  }

  /**
   * 分析之前多张图片的结果，形成最终的总结报告
   * @returns 总结和markdown格式的报告
   */
  async doAnalysisAll(): Promise<{ summary: string; markdown: string }> {
    const messages = this.buildSummaryMessage();
    const data = await this.makeAIRequest(messages);
    const content = data.choices?.[0]?.message?.content;
    const messageContent = JSON.parse(parseJsonBack(content || ''));

    return {
      summary: messageContent.summary || 'No summary available',
      markdown:
        messageContent.markdown || '# No Analysis Available\n\nNo analysis results were generated.',
    };
  }

  /**
   * 当我们停止服务时，清除定时器并且进行最终的总结分析
   */
  async stop(): Promise<AICutAnalysisRes> {
    // 进行最终的总结分析
    try {
      const analysisRes = await this.doAnalysisAll();
      this.result.summary = analysisRes.summary;
      this.result.markdown = analysisRes.markdown;
      console.warn('AI Cut Analysis Service final analysis completed');
    } catch (e) {
      console.error('AI Cut Analysis Service final analysis failed:', e);
    }

    return this.result;
  }

  clearResult(): void {
    this.result = this.createEmptyResult();
  }

  getResult() {
    return this.result;
  }
}

export const downloadMarkdown = (md: string) => {
  const element = document.createElement('a');
  const file = new Blob([md], { type: 'text/markdown' });
  element.href = URL.createObjectURL(file);
  element.download = `ai_cut_analysis_${Date.now()}.md`;
  document.body.appendChild(element); // Required for this to work in FireFox
  element.click();
};

/**
 * 返回格式为:
 * ```json
 * ```
 * @param jsonCode
 */
export const parseJsonBack = (jsonCode: string): string => {
  return jsonCode.replace(/^[\s\S]*?```json/, '').replace(/```[\s\S]*?$/, '');
};
