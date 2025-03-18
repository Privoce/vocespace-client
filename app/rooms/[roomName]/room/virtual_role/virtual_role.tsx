'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { MotionSync } from 'live2d-motionsync/stream';
import * as faceapi from 'face-api.js';

const Live2DComponent = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [detectorReady, setDetectorReady] = useState(false);
  const modelRef = useRef<any>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const trackingRef = useRef<number | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [lastDetectionAt, setLastDetectionAt] = useState<number | null>(null);
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });

  // 实现连续头部追踪的函数
  const startFaceTracking = (model: any, videoElement: HTMLVideoElement) => {
    // 如果已经有追踪在进行，先停止它
    if (trackingRef.current !== null) {
      cancelAnimationFrame(trackingRef.current);
      trackingRef.current = null;
    }

    // 设置追踪状态
    setTrackingActive(true);

    // 创建追踪函数
    const track = async () => {
      if (!videoElement || !model) {
        console.log('视频或模型不可用，停止追踪');
        setTrackingActive(false);
        return;
      }

      // 限制检测频率，减少资源占用
      const now = Date.now();
      if (!lastDetectionAt || now - lastDetectionAt > 100) { // 每200ms检测一次
        try {
          const detection = await faceapi.detectSingleFace(
            videoElement,
            new faceapi.TinyFaceDetectorOptions()
          );

          if (detection) {
            const { x, y, width, height } = detection.box;
            
            // 计算脸部中心点
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            
            // 归一化坐标 (-1 到 1 的范围)
            const normalizedX = ((centerX / videoElement.videoWidth) * 2) - 1;
            const normalizedY = ((centerY / videoElement.videoHeight) * 2) - 1;
            
            // // 将归一化坐标应用于模型
            // console.log('检测到人脸, 归一化坐标:', { x: normalizedX, y: normalizedY });
            // model.focus(normalizedX, -normalizedY); // Y轴需要反转
            // console.log("检测到人脸，坐标:", centerX, centerY);
            // model.focus(centerX, centerY);


            // 将归一化坐标与ScreenSize结合转为真实坐标
            const realX = normalizedX * screenSize.width / 2 + screenSize.width / 2;
            const realY = -normalizedY * screenSize.height / 2 + screenSize.height / 2;
            model.focus(realX, realY);
            console.log("检测到人脸，坐标:", realX, realY);

          }
          
          setLastDetectionAt(now);
        } catch (e) {
          console.error('人脸检测过程中出错:', e);
        }
      }

      // 继续下一帧的追踪
      trackingRef.current = requestAnimationFrame(track);
    };

    // 开始追踪循环
    trackingRef.current = requestAnimationFrame(track);

    // 返回停止追踪的函数
    return () => {
      if (trackingRef.current !== null) {
        cancelAnimationFrame(trackingRef.current);
        trackingRef.current = null;
      }
      setTrackingActive(false);
    };
  };

  // 单次检测人脸，主要用于测试
  const detectFace = async (videoele: HTMLVideoElement) => {
    if (!detectorReady) {
      console.log('检测器未准备好，等待');
      await new Promise<void>((resolve) => {
        const checkDetector = () => {
          if (detectorReady) {
            resolve();
          } else {
            console.log('等待检测器...');
            setTimeout(checkDetector, 2000);
          }
        };
        checkDetector();
      });
    }

    console.log('开始进行头部检测');
    try {
      const detection = await faceapi.detectSingleFace(
        videoele,
        new faceapi.TinyFaceDetectorOptions(),
      );

      if (detection) {
        console.log('检测到人脸', detection);
        const { x, y, width, height } = detection.box;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        return { centerX, centerY };
      }
    } catch (e) {
      console.error('Failed to detect face:', e);
    }
    return null;
  };

  // 第一步：加载核心脚本
  useEffect(() => {
    // 在组件内部
    const loadFaceDetection = async () => {
      try {
        // 暂时使用tinyFaceDetector
        console.log('开始加载人脸检测模型...');
        await faceapi.loadTinyFaceDetectorModel(
          `${process.env.NEXT_PUBLIC_BASE_PATH}/models/tiny_face_detector_model-weights_manifest.json`,
        );
        console.log('人脸检测模型加载成功');
        setDetectorReady(true);
      } catch (error) {
        console.error('加载人脸检测模型失败:', error);
        setError('人脸检测模型加载失败');
      }
    };

    const loadLive2d = () => {
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
    };
    
    const loadVideo = async () => {
      if (!videoRef.current) {
        console.error('视频元素不可用');
        return;
      }
      try {
        // 初始化视频流
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: 'user', // 使用前置摄像头
          },
        });

        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // 避免音频反馈

        // 等待视频元数据加载完成
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return;

          if (videoRef.current.readyState >= 2) {
            resolve();
          } else {
            videoRef.current.onloadeddata = () => resolve();
          }
        });

        console.log('视频元数据加载完成');
        await videoRef.current.play();
        console.log(
          '视频开始播放，视频尺寸:',
          videoRef.current.videoWidth,
          'x',
          videoRef.current.videoHeight,
        );

        // 确保视频已真正开始播放
        if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
          // 再次等待视频尺寸
          await new Promise<void>((resolve) => {
            const checkVideoDimensions = () => {
              if (!videoRef.current) return;

              if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                resolve();
              } else {
                setTimeout(checkVideoDimensions, 100);
              }
            };
            checkVideoDimensions();
          });
        }

        console.log(
          '视频准备完成，尺寸确认:',
          videoRef.current.videoWidth,
          'x',
          videoRef.current.videoHeight,
        );
      } catch (err) {
        console.error('Failed to initialize video:', err);
        setError('无法初始化视频流');
      }
    };

    loadFaceDetection();
    loadLive2d();
    loadVideo();

    return () => {
      // 停止头部追踪
      if (trackingRef.current !== null) {
        cancelAnimationFrame(trackingRef.current);
        trackingRef.current = null;
      }
      
      // 停止视频流
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 第二步：当核心脚本加载完成后，初始化 Live2D 模型
  useEffect(() => {
    if (!scriptLoaded || typeof window === 'undefined') return;

    // 将 PIXI 暴露到 window 上
    (window as any).PIXI = PIXI;

    // 等待一小段时间确保 Live2D 核心完全初始化
    const timer = setTimeout(async () => {
      try {
        // 动态导入 Live2DModel，确保它在核心脚本加载后使用
        const { Live2DModel } = await import('pixi-live2d-display/cubism4');

        Live2DModel.registerTicker(PIXI.Ticker);
        const canvasele = document.getElementById('virtual_role_canvas') as HTMLCanvasElement;
        
        // 初始化 PIXI 应用
        const app = new PIXI.Application({
          view: canvasele,
          resizeTo: window,
          autoStart: true,
        });
        appRef.current = app;
        
        let cleanup = () => {};

        setIsLoading(true);

        if (containerRef.current) {
          // 加载模型
          console.log('开始加载 Live2D 模型...');
          const model: any = await Live2DModel.from(
            `${process.env.NEXT_PUBLIC_BASE_PATH}/live2d_resources/Mao/Mao.model3.json`,
            { autoInteract: false },
          );
          
          // 保存模型引用
          modelRef.current = model;
          
          // 设置口型同步
          const motionSync = new MotionSync(model.internalModel);
          motionSync.loadMotionSyncFromUrl(
            `${process.env.NEXT_PUBLIC_BASE_PATH}/live2d_resources/Mao/sample_01.motion3.json`,
          );
          
          // 获取音频流用于口型同步
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          motionSync.play(mediaStream);

          // 添加到舞台并进行基本设置
          app.stage.addChild(model);
          model.anchor.set(0.5, 0.15);
          model.position.set(app.screen.width / 2, app.screen.height / 2);
          model.scale.set(0.25);
          setScreenSize({
            width: app.screen.width,
            height: app.screen.height,
          });
          // 添加窗口大小调整监听
          const resizeHandler = () => {
            model.position.set(app.screen.width / 2, app.screen.height / 2);
          };

          window.addEventListener('resize', resizeHandler);
          
          // 开始连续的头部追踪
          if (videoRef.current) {
            // 先进行一次单次检测测试
            const pos = await detectFace(videoRef.current);
            if (pos) {
              console.log("初始人脸位置:", pos);
              // 使用原始坐标测试
              model.focus(pos.centerX, pos.centerY);
            }
            
            // 然后开始连续追踪
            console.log("开始连续头部追踪");
            const stopTracking = startFaceTracking(model, videoRef.current);
            
            // 将停止追踪函数添加到清理函数中
            const originalCleanup = cleanup;
            cleanup = () => {
              originalCleanup();
              stopTracking();
            };
          }

          // 设置清理函数
          cleanup = () => {
            window.removeEventListener('resize', resizeHandler);
            app.destroy(true);
            motionSync.reset();
            mediaStream.getTracks().forEach((track) => track.stop());
            
            // 确保停止追踪
            if (trackingRef.current !== null) {
              cancelAnimationFrame(trackingRef.current);
              trackingRef.current = null;
            }
          };

          setIsLoading(false);
          console.log('Live2D 模型加载完成');
        }

        return () => cleanup();
      } catch (err: any) {
        console.error('Failed to initialize Live2D:', err);
        setError(`Live2D 模型加载失败: ${err.message}`);
        setIsLoading(false);
      }
    }, 500); // 给予核心脚本 500ms 的加载时间

    return () => clearTimeout(timer);
  }, [scriptLoaded]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            zIndex: 10,
          }}
        >
          虚拟角色加载中...
        </div>
      )}

      {error && (
        <div
          style={{
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
            zIndex: 10,
          }}
        >
          {error}
        </div>
      )}
      
      <canvas
        id="virtual_role_canvas"
        style={{ height: '100%', width: '100%', position: 'absolute' }}
      ></canvas>
      
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '160px',
          height: '120px',
          border: trackingActive ? '2px solid green' : '2px solid red',
          zIndex: 20,
        }}
        playsInline
        muted
      />
      
      {/* 添加控制按钮 */}
      <div 
        style={{ 
          position: 'absolute', 
          left: '10px', 
          bottom: '10px', 
          zIndex: 30,
          display: 'flex',
          gap: '8px'
        }}
      >
        <button
          style={{
            padding: '8px 12px',
            backgroundColor: trackingActive ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          onClick={() => {
            if (trackingActive) {
              // 停止追踪
              if (trackingRef.current !== null) {
                cancelAnimationFrame(trackingRef.current);
                trackingRef.current = null;
              }
              setTrackingActive(false);
            } else {
              // 开始追踪
              if (videoRef.current && modelRef.current) {
                startFaceTracking(modelRef.current, videoRef.current);
              } else {
                alert('视频或模型未准备好');
              }
            }
          }}
        >
          {trackingActive ? '停止头部追踪' : '开始头部追踪'}
        </button>
        
        <button
          style={{
            padding: '8px 12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          onClick={async () => {
            // 执行一次人脸检测测试
            if (videoRef.current) {
              const pos = await detectFace(videoRef.current);
              
              if (pos && modelRef.current) {
                // 归一化坐标
                const normalizedX = ((pos.centerX / videoRef.current.videoWidth) * 2) - 1;
                const normalizedY = ((pos.centerY / videoRef.current.videoHeight) * 2) - 1;
                
                modelRef.current.focus(normalizedX, -normalizedY);
                alert(`检测到人脸，坐标: (${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)})`);
              } else {
                alert('未检测到人脸');
              }
            } else {
              alert('视频未准备好');
            }
          }}
        >
          测试人脸检测
        </button>
      </div>
      
      {/* 状态显示 */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 30,
        }}
      >
        检测状态: {trackingActive ? '追踪中' : '未追踪'}
        <br />
        检测器: {detectorReady ? '已加载' : '加载中'}
      </div>
    </div>
  );
};

export default Live2DComponent;