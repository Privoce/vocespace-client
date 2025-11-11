// app/api/ai/analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '../conf/conf';
import { AnalysisRequestBody } from '@/lib/api/ai';
import { AICutAnalysisService } from '@/lib/ai/analysis';
import { getDefaultPrompts } from '@/lib/ai/load';

const { ai } = getConfig();

// 检查 AI 配置是否完整
const checkAiConfig = (): boolean => {
  if (!ai || !ai.enabled) return false;
  if (ai.apiKey && ai.apiUrl && ai.model) {
    return true;
  }
  return false;
};

let promptsConfig: ReturnType<typeof getDefaultPrompts>;
try {
  promptsConfig = getDefaultPrompts();
} catch (error) {
  console.error('加载提示词配置失败，使用默认配置:', error);
}

/**
 * 存储每个用户的 AI 分析服务实例
 * Map<spaceName, Map<userId, AICutAnalysisService>>
 */
const AI_CUT_ANALYSIS_SERVICES = new Map<string, Map<string, AICutAnalysisService>>();

// 提取通用的用户服务获取逻辑
const getUserService = (spaceName: string, userId: string): AICutAnalysisService | null => {
  const spaceServices = AI_CUT_ANALYSIS_SERVICES.get(spaceName);
  if (!spaceServices) return null;
  return spaceServices.get(userId) || null;
};

// 提取通用的错误响应
const createErrorResponse = (message: string, status: number = 400) => {
  return NextResponse.json({ error: message }, { status });
};

export async function GET(request: NextRequest) {
  if (!checkAiConfig()) {
    return createErrorResponse('AI configuration is incomplete or AI is disabled.', 500);
  }

  try {
    const action = request.nextUrl.searchParams.get('action')!;
    const spaceName = request.nextUrl.searchParams.get('spaceName')!;
    const userId = request.nextUrl.searchParams.get('userId')!;

    const userService = getUserService(spaceName, userId);
    if (!userService) {
      if (action === 'stop') {
        return NextResponse.json({ md: '', success: true });
      }
      return createErrorResponse('No AI analysis service found for this user.');
    }

    switch (action) {
      case 'stop':
        const res = await userService.stop();
        // 删除服务实例
        const spaceServices = AI_CUT_ANALYSIS_SERVICES.get(spaceName);
        spaceServices?.delete(userId);
        return NextResponse.json({ md: res?.markdown, success: true });

      case 'md':
        const analysisResult = userService.getResult().markdown;
        return NextResponse.json({ md: analysisResult });

      case 'result':
        const finalResult = userService.getResult();
        return NextResponse.json({ res: finalResult });

      default:
        return createErrorResponse('Invalid action parameter.');
    }
  } catch (e) {
    console.error('GET request error:', e);
    return createErrorResponse('Failed to process AI analysis request.', 500);
  }
}

// 提取获取或创建用户服务的逻辑
const getOrCreateUserService = (
  spaceName: string,
  userId: string,
  lang: string,
): AICutAnalysisService => {
  let spaceServices = AI_CUT_ANALYSIS_SERVICES.get(spaceName);

  if (!spaceServices) {
    spaceServices = new Map<string, AICutAnalysisService>();
    AI_CUT_ANALYSIS_SERVICES.set(spaceName, spaceServices);
  }

  let userService = spaceServices.get(userId);
  if (!userService) {
    userService = new AICutAnalysisService(
      ai!.apiKey,
      ai!.apiUrl,
      ai!.model,
      promptsConfig.analysisPrompt,
      promptsConfig.summaryPrompt,
      lang,
    );
    spaceServices.set(userId, userService);
  }

  return userService;
};

export async function POST(request: NextRequest) {
  if (!checkAiConfig()) {
    return createErrorResponse('AI configuration is incomplete or AI is disabled.', 500);
  }

  try {
    const { spaceName, userId, screenShot, todos, lang }: AnalysisRequestBody =
      await request.json();
    // 获取或创建用户服务实例
    const targetService = getOrCreateUserService(spaceName, userId, lang);
    // 进行分析
    await targetService.doAnalysisLine(screenShot, todos);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('POST request error:', e);
    return createErrorResponse('Failed to process AI analysis request.', 500);
  }
}
