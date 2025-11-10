import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';

/**
 * 提示词模板接口
 */
export interface PromptTemplates {
  /**
   * 系统提示词
   */
  system: string;
  /**
   * 用户提示词
   */
  user: string;
}

/**
 * TOML 配置接口
 */
interface PromptsConfig {
  /**
   * 分析提示词配置
   */
  analysis: PromptTemplates;
  /**
   * 总结提示词配置（可选）
   */
  summary?: PromptTemplates;
}

/**
 * 加载 TOML 格式的提示词配置
 * @param filePath TOML 文件路径（相对于项目根目录）
 * @returns 提示词配置对象
 */
export function loadPromptsFromToml(filePath: string): {
  analysisPrompt: PromptTemplates;
  summaryPrompt?: PromptTemplates;
} {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const tomlContent = fs.readFileSync(fullPath, 'utf-8');
    const config = TOML.parse(tomlContent) as unknown as PromptsConfig;

    return {
      analysisPrompt: {
        system: config.analysis.system,
        user: config.analysis.user,
      },
      summaryPrompt: config.summary
        ? {
            system: config.summary.system,
            user: config.summary.user,
          }
        : undefined,
    };
  } catch (error) {
    console.error('Failed to load prompts from TOML:', error);
    throw error;
  }
}

/**
 * 获取默认的提示词配置（从 prompts_zh.toml）
 * 当前先使用中文提示词，后续功能稳定后增加多语言支持
 */
export function getDefaultPrompts(): {
  analysisPrompt: PromptTemplates;
  summaryPrompt?: PromptTemplates;
} {
  return loadPromptsFromToml('/prompt/prompts_zh.toml');
}
