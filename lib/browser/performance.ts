import { getGPUTier } from 'detect-gpu';

type PerfLevel = 'low' | 'medium' | 'high';

/**
 * 客户端性能检测类
 * 一般在项目启动初始化时调用，判断性能等级
 * @class PerformanceDetector
 */
export class PerformanceDetector {
  static async detectPerformanceLevel(): Promise<PerfLevel> {
    const gpuLevel = await this.detectGPU();
    const systemInfo = this.getSystemInfo();

    // 综合判断性能等级
    if (gpuLevel === 'low' || systemInfo.isMobile || systemInfo.cores <= 2) {
      return 'low';
    } else if (systemInfo.cores >= 6 && gpuLevel === 'high') {
      return 'high';
    } else {
      return 'medium';
    }
  }

  static getSystemInfo() {
    return {
      cores: navigator.hardwareConcurrency || 2,
      // 某些浏览器支持内存检测
      memory: (navigator as any).deviceMemory || 4,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent),
      isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
    };
  }

  static async getGPUInfo() {
    const canvas = document.createElement('canvas');
    const gl: WebGLRenderingContext | null = canvas.getContext('webgl');

    if (!gl) {
      return { supported: false, tier: 0, renderer: 'unsupported' };
    }

    // 尝试获取渲染器信息
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);

    // 简单的GPU分级(可扩展)
    let tier = 1; // 默认低级别

    // 检测高端GPU特征词
    const highEndGPUs = ['RTX', 'Radeon Pro', 'AMD Radeon', 'NVIDIA', 'Apple M'];
    if (highEndGPUs.some((gpu) => renderer.includes(gpu))) {
      tier = 3;
    }
    // 检测中端GPU特征词
    else if (renderer.includes('Intel') || renderer.includes('AMD')) {
      tier = 2;
    }

    return {
      supported: true,
      tier,
      renderer,
    };
  }

  static async detectGPU(): Promise<PerfLevel> {
    try {
      const gpuTier = await getGPUTier();

      switch (gpuTier.tier) {
        case 0:
        case 1:
          return 'low';
        case 2:
          return 'medium';
        case 3:
          return 'high';
        default:
          return 'medium';
      }
    } catch (e) {
      console.warn('GPU检测失败', e);
      return 'medium';
    }
  }
}
