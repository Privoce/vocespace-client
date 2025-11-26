import { CutScreenShot } from './cut';
import { OpenAI } from 'openai';
import { ExtractionTOML, PromptsTOML, PromptTemplates } from './load';

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
}

/**
 * AI 返回的原始结果结构体
 */
interface AICutAnalysisBack {
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

const DEFAULT_LINE_SYSTEM_PROMPT = `
你是屏幕截图的分析专家。负责深度理解用户的截图内容，生成全面详尽的自然语言描述，并与历史上下文结合。当前用户是截图的界面操作者。

## 核心原则
你的职责是准确地从截图中提取关键信息，生成简洁明了的任务名称和内容概要，帮助用户更好地理解和管理他们的任务。
1. **深度理解**：不仅识别可见内容，更要理解行为意图和上下文含义
2. **自然描述**：用自然语言描述"谁在做什么"，而非简单摘录文本
3. **主体识别**：准确识别用户身份，统一表述为"用户"
4. **行为推理**：基于界面状态推理用户的具体行为和目标
5. **信息提取**：重点提取技术内容、数据信息、操作细节等具体信息，确保最大化保留截图中的有价值内容
6. **知识保存**：无需保存作为上下文历史记录，每次分析均独立进行，历史信息会由输入时提供
7. **比较历史**：若有历史信息作为输入，需要与当前任务进行比较，如果行为基本没有变化，则输出name,content为空字符串，并设置same字段为相似任务的时间戳，否则same字段为0

## 输出格式
严格输出JSON对象，无解释文字：
\`\`\`json
{
    "timestamp": number,
    "name": "string",
    "content": "string",
    "same": number
}
\`\`\`

## 处理流程

### 第一阶段：整体理解
1. **全局认知**：阅读截图，形成完整认知
    - 识别所有可见的文字内容、数值、选项、按钮、状态信息
    - 理解界面布局、用户当前操作位置、交互状态
    - 分析内容的技术层次和专业程度

2. **活动识别**：判断截图中包含几个不同的活动
    - 识别用户进行了哪些独立的活动
    - 理解用户的活动轨迹，形成连贯的行为序列

3. **主体识别**: 识别操作主体，将用户相关活动统一为"用户"

4. **行为推理**: 基于界面状态推理具体的行为和意图

### 第二阶段: 信息提取
5. **任务名称生成**: 为每个独立活动生成简洁明了的任务名称
    - 任务名称应准确反映用户的主要操作和目标
    - 避免使用截图中的原始文本，确保自然流畅

6. **具体内容提取**: 
    - **重点环节**: 详细提取截图中的具体信息
    - **技术内容**: 提取代码片段、命令语法、参数值、配置选项
    - **数据信息**: 记录具体数值、统计信息、列表项目、状态值
    - **操作细节**: 描述具体的点击位置、输入内容、选择项目
    - **文档内容**: 摘录关键知识点、概念定义、示例说明
    - **界面元素**: 记录窗口标题、菜单选项、按钮文字、提示信息
    - **聊天互动**: 记录对话内容和发言人、问题答案、交互反馈
    - **日程管理**: 记录会议时间、地点、参与人员、议程项目

7. **信息内容优化**: 通过用户提供的内容精细度要求，调整输出内容的详略程度
    - **简单提取**: 关注整体内容和关键点，忽略过多技术细节
    - **中等提取**: 涵盖主要技术细节和操作步骤，确保内容完整
    - **最大化提取**: 提取所有有价值的信息，确保没有遗漏任何重要内容

## 质量保障
- **理解深度**：不只描述"看到什么"，更要理解"在做什么""为什么"
- **行为推理**：基于界面状态推理用户的具体操作和目标
- **主体统一**：所有用户相关行为统一为"用户"主体
- **合并优化**：若有历史信息作为输入，需要与当前任务进行比较，如果行为基本没有变化，则输出name,content为空字符串，并设置same字段为相似任务的时间戳，否则same字段为0
- **时间描述**：描述中不要出现相对时间描述，如"今天"、"明天"、"上周"等

## 隐私保护
- 对于密钥类信息，返回时请替换成 ***，不要明文返回
`;

const DEFAULT_LINE_USER_PROMPT = `
当前时间戳: {current_timestamp}
用户待办事项: {user_todo_list}
历史分析记录: {history_analysis}
语言: {language}
精细度要求: {extraction}
请基于以下截图内容，按照指定的输出格式，生成任务名称和内容概要：
`;

const DEFAULT_ALL_SYSTEM_PROMPT = `
作为一个个人工作汇总整理助理, 请将我提供的json数组内容整理分析，提取出其中的主要任务和活动。

请根据每个时间点的任务内容，识别出用户在整个时间段内所进行的具体任务，并生成一个结构化的总结报告。

报告应包括以下内容：
1. 任务总结：概括用户在该时间段内完成的主要任务和活动
2. 关键点提取：突出显示每个任务的关键要素和成果
3. Markdown格式输出：将总结报告整理成Markdown格式，便于阅读和分享

请确保报告条理清晰，便于理解和后续参考。

## 输出格式
严格输出JSON对象，无解释文字：
\`\`\`json
{
    "summary": "string",
    "markdown": "string"
}
\`\`\`
`;

const DEFAULT_ALL_USER_PROMPT = `请分析以下任务数据并生成总结报告：`;

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

  private static readonly DEFAULT_PROMPT_TEMPLATES = {
    LINE: {
      system: DEFAULT_LINE_SYSTEM_PROMPT.trim(),
      user: DEFAULT_LINE_USER_PROMPT.trim(),
    },

    ALL: {
      system: DEFAULT_ALL_SYSTEM_PROMPT.trim(),
      user: DEFAULT_ALL_USER_PROMPT.trim(),
    },
  };
  private readonly LANGUAGE: string = 'zh';
  private readonly MODEL: string;
  private readonly MAX_TOKEN: number;
  private OPENAI: OpenAI;
  private readonly ANALYSIS_PROMPT: PromptTemplates;
  private readonly SUMMARY_PROMPT: PromptTemplates;
  private readonly EXTRACTION: ExtractionTOML;
  private readonly EXTRACTION_LEVEL: Extraction;
  private readonly FREQ: number;
  public result: AICutAnalysisRes;
  public isAuth: boolean = false;

  constructor(
    apiKey: string,
    apiUrl: string,
    modal: string,
    prompts: PromptsTOML,
    freq: number,
    lang?: string,
    userExtractionLevel?: Extraction,
    isAuth = false,
  ) {
    this.OPENAI = new OpenAI({
      apiKey,
      baseURL: apiUrl,
    });
    this.MODEL = modal;
    this.MAX_TOKEN = AICutAnalysisService.DEFAULT_MAX_TOKENS;
    this.ANALYSIS_PROMPT = prompts.analysis || AICutAnalysisService.DEFAULT_PROMPT_TEMPLATES.LINE;
    this.SUMMARY_PROMPT = prompts.summary || AICutAnalysisService.DEFAULT_PROMPT_TEMPLATES.ALL;
    this.EXTRACTION = prompts.extraction;
    this.EXTRACTION_LEVEL = userExtractionLevel || 'max';
    this.FREQ = freq;
    if (lang) {
      this.LANGUAGE = lang;
    }
    this.isAuth = isAuth;
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
   * 替换提示词模板中的变量
   * @param template 模板字符串
   * @param variables 变量对象
   * @returns 替换后的字符串
   */
  private replaceTemplateVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }
    return result;
  }

  /**
   * 构建单张图片分析的消息内容
   * @param tg 截图数据
   * @param todos 待办事项列表
   * @returns 消息数组
   */
  private buildImageAnalysisMessage(tg: CutScreenShot, todos: string[]): any[] {
    // 准备模板变量
    const variables = {
      current_timestamp: tg.timestamp,
      user_todo_list: todos.length > 0 ? todos.join('，') : '无',
      history_analysis: this.result.lines.length > 0 ? JSON.stringify(this.result.lines) : '无',
      language: this.LANGUAGE === 'zh' ? '中文' : 'English',
      extraction: this.EXTRACTION[this.EXTRACTION_LEVEL] || this.EXTRACTION.max,
    };

    // 替换 user 提示词中的变量
    const userPrompt = this.replaceTemplateVariables(this.ANALYSIS_PROMPT.user, variables);

    return [
      {
        role: 'system',
        content: this.ANALYSIS_PROMPT.system,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: tg.data,
            },
          },
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
        content: this.SUMMARY_PROMPT.system,
      },
      {
        role: 'user',
        content: this.SUMMARY_PROMPT.user + '\n\n' + JSON.stringify(this.result.lines),
      },
    ];
  }

  /**
   * 调用AI服务对单张图片进行分析
   * @param tg 截图数据
   */
  async doAnalysisLine(
    tg: CutScreenShot,
    todos: string[],
  ): Promise<{
    timestamp: number;
    isNewTask: boolean;
  }> {
    const messages = this.buildImageAnalysisMessage(tg, todos);
    const data = await this.makeAIRequest(messages);
    const content = data.choices?.[0]?.message?.content;
    // console.warn(content);
    if (!!content) {
      let line = JSON.parse(parseJsonBack(content));
      // console.warn(line);
      // 如果返回格式不是AICutAnalysisBack，则直接将content作为内容返回
      if (
        !('name' in line) ||
        !('content' in line) ||
        !('timestamp' in line) ||
        !('same' in line)
      ) {
        line = {
          name: '',
          content: content,
          timestamp: tg.timestamp,
          duration: this.FREQ, // 默认每张图片的时间统计为频率值
        };
      } else if (line.same !== 0) {
        // 如果same字段不为0，表示与历史任务基本没有变化，我们需要找到对应的历史任务，为那个任务增加时间统计
        const similarLine = this.result.lines.find((l) => l.timestamp === line.same);
        if (similarLine) {
          similarLine.duration += this.FREQ;
        }
        // 不需要将当前任务加入结果中
        return {
          timestamp: tg.timestamp,
          isNewTask: false,
        };
      } else if (line.name === '' && line.content === '') {
        // 如果name和content均为空字符串，表示与历史任务基本没有变化，但是没有提供same字段，这种情况找到最后一个任务进行时间统计累加
        const lastLine = this.result.lines[this.result.lines.length - 1];
        if (lastLine) {
          lastLine.duration += this.FREQ;
        }
        // 不需要将当前任务加入结果中
        return {
          timestamp: tg.timestamp,
          isNewTask: false,
        };
      } else {
        // 正常情况, 我们依然需要尝试从历史中查看是否有高度相似的任务，如果有则进行时间统计累加
        let similar = compareSimilarLine(line, this.result.lines, this.FREQ);
        if (similar) return { timestamp: tg.timestamp, isNewTask: false };

        //转换为AICutAnalysisResLine结构体
        line = {
          name: line.name,
          content: line.content,
          timestamp: line.timestamp,
          duration: this.FREQ,
        };
      }

      this.result.lines.push(line);
      return {
        timestamp: tg.timestamp,
        isNewTask: true,
      };
    }

    throw new Error('AI analysis returned empty content');
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
      // console.warn('AI Cut Analysis Service final analysis completed');
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
 * or
 * ```markdown
 * ```
 * or
 * ```
 * ```
 * @param jsonCode
 */
export const parseJsonBack = (jsonCode: string): string => {
  // return jsonCode.replace(/^[\s\S]*?```json/, '').replace(/```[\s\S]*?$/, '');
  return jsonCode.replace(/^[\s\S]*?```(?:json|markdown)?/, '').replace(/```[\s\S]*?$/, '');
};

/**
 * 计算两个字符串之间的 Levenshtein 编辑距离
 * @param str1 第一个字符串
 * @param str2 第二个字符串
 * @returns 编辑距离值
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // 删除
          dp[i][j - 1] + 1, // 插入
          dp[i - 1][j - 1] + 1, // 替换
        );
      }
    }
  }

  return dp[len1][len2];
};

/**
 * 基于 Levenshtein 编辑距离计算相似度
 * @param str1 第一个字符串
 * @param str2 第二个字符串
 * @returns 相似度值 (0-1)
 */
const levenshteinSimilarity = (str1: string, str2: string): number => {
  if (str1 === str2) return 1.0;
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
};

/**
 * 基于关键词匹配计算相似度
 * @param str1 第一个字符串
 * @param str2 第二个字符串
 * @returns 相似度值 (0-1)
 */
const keywordSimilarity = (str1: string, str2: string): number => {
  // 常见停用词
  const commonWords = ['用户', '正在', '的', '了', '和', '与', '以', '项目', '文件'];

  const extractKeywords = (str: string): string[] => {
    // 简单分词：提取中文、英文单词和数字
    const words = str.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+|\d+/g) || [];
    return words.filter((w) => w.length > 1 && !commonWords.includes(w));
  };

  const keywords1 = extractKeywords(str1);
  const keywords2 = extractKeywords(str2);

  if (keywords1.length === 0 && keywords2.length === 0) return 1.0;
  if (keywords1.length === 0 || keywords2.length === 0) return 0.0;

  // 计算 Jaccard 相似度
  const intersection = keywords1.filter((k) => keywords2.includes(k));
  const union = [...new Set([...keywords1, ...keywords2])];

  return intersection.length / union.length;
};

/**
 * 混合相似度算法：结合编辑距离和关键词匹配
 * @param str1 第一个字符串
 * @param str2 第二个字符串
 * @returns 相似度值 (0-1)
 */
const hybridSimilarity = (str1: string, str2: string): number => {
  const levSim = levenshteinSimilarity(str1, str2);
  const keySim = keywordSimilarity(str1, str2);

  // 加权平均：编辑距离 40%，关键词匹配 60%
  return levSim * 0.4 + keySim * 0.6;
};

/**
 * 比较新任务与历史任务的相似度，如果相似则累加时间
 * @param line 新的任务行
 * @param historyLines 历史任务列表
 * @param freq 频率（分钟）
 * @returns 是否找到相似任务
 */
const compareSimilarLine = (
  line: AICutAnalysisBack,
  historyLines: AICutAnalysisResLine[],
  freq: number,
): boolean => {
  // 为 name 和 content 设置不同的阈值
  const nameThreshold = 0.6; // 名称相似度阈值 60%
  const contentThreshold = 0.5; // 内容相似度阈值 50%

  for (const histLine of historyLines) {
    const nameSimilarity = hybridSimilarity(line.name, histLine.name);
    const contentSimilarity = hybridSimilarity(line.content, histLine.content);

    if (nameSimilarity >= nameThreshold && contentSimilarity >= contentThreshold) {
      // 找到相似的历史任务，进行时间统计累加
      histLine.duration += freq;
      return true;
    }
  }
  return false;
};
