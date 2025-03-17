'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
// import { Live2DModel } from 'pixi-live2d-display';

// 注意：我们不在顶部直接导入 Live2DModel
// 而是在确认核心脚本加载后导入

const Live2DComponent = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // 第一步：加载核心脚本
  useEffect(() => {
    // 检查是否已经加载
    if (document.querySelector('script[src*="live2d.min.js"]')) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `${process.env.NEXT_PUBLIC_BASE_PATH}/live2d_resources/live2d.min.js`;
    console.warn('开始加载 Live2D 核心脚本...', script.src);
    script.async = true;

    script.onload = () => {
      console.log('Live2D 核心脚本加载成功');
      setScriptLoaded(true);
    };

    script.onerror = (e) => {
      console.error('Live2D 核心脚本加载失败:', e);
      setError('无法加载 Live2D 核心库');
    };

    document.head.appendChild(script);

    return () => {
      // 组件卸载时不移除脚本，因为其他地方可能还需要它
    };
  }, []);

  // 第二步：当核心脚本加载完成后，初始化 Live2D 模型
  useEffect(() => {
    if (!scriptLoaded || typeof window === 'undefined') return;

    // 将 PIXI 暴露到 window 上
    (window as any).PIXI = PIXI;

    // 等待一小段时间确保 Live2D 核心完全初始化
    const timer = setTimeout(async () => {
      // 动态导入 Live2DModel，确保它在核心脚本加载后使用
      const { Live2DModel } = await import('pixi-live2d-display/cubism4');
      Live2DModel.registerTicker(PIXI.Ticker);
      // 初始化 PIXI 应用
      const app = new PIXI.Application({
        view: document.getElementById('virtual_role_canvas') as HTMLCanvasElement,
        resizeTo: window,
        autoStart: true,
      });
      let cleanup = () => {};

      try {
        setIsLoading(true);

        if (containerRef.current) {
          // 加载模型
          console.log('开始加载 Live2D 模型...');
          const model: any = await Live2DModel.from(
            `${process.env.NEXT_PUBLIC_BASE_PATH}/live2d_resources/Mao/Mao.model3.json`,
          );
          app.stage.addChild(model);
          model.anchor.set(0.5, 0.5);
          model.position.set(app.screen.width / 2, app.screen.height / 2);
          // model.position.set(window.innerWidth / 2, window.innerHeight / 2);
          model.scale.set(0.1);

          // 添加窗口大小调整监听
          const resizeHandler = () => {
            model.position.set(app.screen.width / 2, app.screen.height / 2);
          };

          window.addEventListener('resize', resizeHandler);

          cleanup = () => {
            window.removeEventListener('resize', resizeHandler);
            app.destroy(true);
            // if (containerRef.current?.contains(app.view)) {
            //   containerRef.current.removeChild(app.view);
            // }
          };

          setIsLoading(false);
          console.log('Live2D 模型加载完成');
        }
      } catch (err: any) {
        console.error('Failed to initialize Live2D:', err);
        setError(`Live2D 模型加载失败: ${err.message}`);
        setIsLoading(false);
      }

      return () => cleanup();
    }, 500); // 给予核心脚本 500ms 的加载时间

    return () => clearTimeout(timer);
  }, [scriptLoaded]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          zIndex: 10
        }}>
          虚拟角色加载中...
        </div>
      )}
      
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(220, 53, 69, 0.8)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          maxWidth: '80%',
          textAlign: 'center',
          zIndex: 10
        }}>
          {error}
        </div>
      )}
      <canvas
          id="virtual_role_canvas"
          style={{ height: '100%', width: '100%', position: 'absolute' }}
        ></canvas>
    </div>
  );
};

export default Live2DComponent;
