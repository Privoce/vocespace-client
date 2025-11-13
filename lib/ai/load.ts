import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import { Extraction } from './analysis';

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

export interface ExtractionTOML {
  easy: string;
  medium: string;
  max: string;
}

/**
 * TOML 配置接口
 */
export interface PromptsTOML {
  /**
   * 分析提示词配置
   */
  analysis: PromptTemplates;
  /**
   * 总结提示词配置
   */
  summary: PromptTemplates;
  /**
   * 结构化提取级别
   */
  extraction: ExtractionTOML;
}

/**
 * 加载 TOML 格式的提示词配置
 * @param filePath TOML 文件路径（相对于项目根目录）
 * @returns 提示词配置对象
 */
export function loadPromptsFromToml(filePath: string): PromptsTOML {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const tomlContent = fs.readFileSync(fullPath, 'utf-8');
    const config = TOML.parse(tomlContent) as unknown as PromptsTOML;
    return {
      analysis: {
        system: config.analysis.system,
        user: config.analysis.user,
      },
      summary: {
        system: config.summary.system,
        user: config.summary.user,
      },
      extraction: config.extraction,
    };
  } catch (error) {
    console.error('Failed to load prompts from TOML:', error);
    throw error;
  }
}

/**
 * 获取默认的提示词配置
 */
export function getDefaultPrompts(lang?: string): PromptsTOML {
  if (!lang || !['en', 'zh'].includes(lang)) {
    return getDefaultPrompts('zh');
  }

  let source = `/prompt/prompts_${lang}.toml`;
  return loadPromptsFromToml(source);
}
