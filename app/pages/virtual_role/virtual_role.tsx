'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { MotionSync } from 'live2d-motionsync/stream';
import * as faceapi from 'face-api.js';
import styles from '@/styles/virtual_role.module.scss';
import { VirtualRoleProps } from './live2d';
import { ModelRole } from '@/lib/std/virtual';
import { src } from '@/lib/std';

export const Live2DComponent = ({
  video_ele: videoRef,
  model_bg,
  model_role,
  enabled,
  onVirtualStreamReady,
}: VirtualRoleProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  // const videoRef = useRef<HTMLVideoElement>(null);
  const [detectorReady, setDetectorReady] = useState(false);
  const modelRef = useRef<any>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const trackingRef = useRef<number | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [lastDetectionAt, setLastDetectionAt] = useState<number | null>(null);
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);
  const smoothnessFactorRef = useRef(0.25); // 添加平滑过渡因子 (0-1之间，越小越平滑)
  // 实现连续头部追踪的函数
  const startFaceTracking = (model: any, videoElement: HTMLVideoElement) => {
    if (!enabled || trackingActive) return () => {};

    // 如果已经有追踪在进行，先停止它
    if (trackingRef.current !== null) {
      cancelAnimationFrame(trackingRef.current);
      trackingRef.current = null;
    }

    // 创建追踪函数
    const track = async () => {
      if (!videoElement || !model || !enabled) {
        console.log('视频或模型不可用，停止追踪');
        setTrackingActive(false);
        trackingRef.current = null;
        return;
      }
      const detection = await faceapi
        .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      // 限制检测频率，减少资源占用
      const now = Date.now();
      if (!lastDetectionAt || now - lastDetectionAt > 460) {
        try {
          if (detection) {
            setIsLoading(false);
            if (!trackingActive) {
              setTrackingActive(true);
            }
            // 设置追踪状态
            const landmarks = detection.landmarks;
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const nose = landmarks.getNose();
            // 计算眼睛中心点 (取左右眼和鼻尖三点加权平均)
            const leftEyeCenter = {
              x: leftEye.reduce((sum, point) => sum + point.x, 0) / leftEye.length,
              y: leftEye.reduce((sum, point) => sum + point.y, 0) / leftEye.length,
            };

            const rightEyeCenter = {
              x: rightEye.reduce((sum, point) => sum + point.x, 0) / rightEye.length,
              y: rightEye.reduce((sum, point) => sum + point.y, 0) / rightEye.length,
            };

            const noseTip = nose[nose.length - 1];

            // 计算加权中心点 (眼睛位置权重较高)
            const centerX = leftEyeCenter.x * 0.35 + rightEyeCenter.x * 0.35 + noseTip.x * 0.3;
            const centerY = leftEyeCenter.y * 0.4 + rightEyeCenter.y * 0.4 + noseTip.y * 0.2;

            // 归一化坐标 (-1 到 1 的范围)
            const normalizedX = (centerX / videoElement.videoWidth) * 2 - 1;
            const normalizedY = (centerY / videoElement.videoHeight) * 2 - 1;

            // 将归一化坐标与ScreenSize结合转为真实坐标
            let realX = (normalizedX * screenSize.width) / 2 + screenSize.width / 2;
            let realY = (-normalizedY * screenSize.height) / 2 + screenSize.height / 2;

            // 添加平滑过渡
            if (lastPosition) {
              const smoothness = smoothnessFactorRef.current;
              realX = lastPosition.x * (1 - smoothness) + realX * smoothness;
              realY = lastPosition.y * (1 - smoothness) + realY * smoothness;
            }

            // 保存当前位置用于下次平滑计算
            setLastPosition({ x: realX, y: realY });

            // 添加轻微的自然偏移来模拟人眼微动
            const microMovementX = Math.sin(Date.now() / 2000) * 5;
            const microMovementY = Math.cos(Date.now() / 2500) * 3;
            console.log('微动:', realX + microMovementX, realY + microMovementY);
            // 应用focus
            model.focus(realX + microMovementX, realY + microMovementY);
          }

          setLastDetectionAt(now);
        } catch (e) {
          console.error('人脸检测过程中出错:', e);
        }
      }

      // 继续下一帧的追踪
      if (enabled) {
        trackingRef.current = requestAnimationFrame(track);
      }
    };

    // 开始追踪循环
    trackingRef.current = requestAnimationFrame(track);

    // 返回停止追踪的函数
    return () => {
      if (trackingRef.current !== null) {
        cancelAnimationFrame(trackingRef.current);
      }
      trackingRef.current = null;
      setTrackingActive(false);
    };
  };

  // 第一步：加载核心脚本
  useEffect(() => {
    if (!enabled) return;
    // 在组件内部
    const loadFaceDetection = async () => {
      try {
        // 暂时使用tinyFaceDetector
        console.log('开始加载人脸检测模型...');
        await faceapi.loadTinyFaceDetectorModel(
          src(`/models/tiny_face_detector_model-weights_manifest.json`),
        );
        await faceapi.loadFaceLandmarkModel(
          src(`/models/face_landmark_68_model-weights_manifest.json`),
        );

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
      script.src = src(`/live2d_resources/live2d.min.js`);
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
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [enabled]);

  // 第二步：当核心脚本加载完成后，初始化 Live2D 模型
  useEffect(() => {
    if (!enabled) return;
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
          transparent: true,
        });
        appRef.current = app;

        let cleanup = () => {};

        setIsLoading(true);

        if (containerRef.current) {
          // 加载模型
          console.log('开始加载 Live2D 模型...');
          const model: any = await Live2DModel.from(
            src(`/live2d_resources/${model_role}/${model_role}.model3.json`),
            { autoInteract: false },
          );

          const bg = await PIXI.Sprite.from(src(`/images/bg/${model_bg}`));
          bg.width = app.screen.width;
          bg.height = app.screen.height;
          app.stage.addChildAt(bg, 0);
          // 保存模型引用
          modelRef.current = model;

          // 设置口型同步
          const motionSync = new MotionSync(model.internalModel);
          let motion_file = '';
          let anchor_y = 0.15;
          let scale = 0.25;
          switch (model_role) {
            case ModelRole.Haru: {
              motion_file = 'haru_g_idle.motion3';
              anchor_y = 0.1;
              scale = 0.48;
              break;
            }
            case ModelRole.Hiyori: {
              motion_file = 'Hiyori_m01.motion3';
              anchor_y = 0.1;
              scale = 0.46;
              break;
            }
            case ModelRole.Mao: {
              motion_file = 'mtn_01.motion3';
              anchor_y = 0.15;
              break;
            }
            case ModelRole.Mark: {
              motion_file = 'mark_m01.motion3';
              anchor_y = 0.3;
              scale = 0.45;
              break;
            }
            case ModelRole.Natori: {
              motion_file = 'mtn_00.motion3';
              break;
            }
            case ModelRole.Rice: {
              motion_file = 'mtn_01.motion3';
              break;
            }
          }

          motionSync.loadMotionSyncFromUrl(
            src(`/live2d_resources/${model_role}/motions/${motion_file}.json`),
          );

          // 获取音频流用于口型同步
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          motionSync.play(mediaStream);

          // 添加到舞台并进行基本设置
          app.stage.addChild(model);
          model.anchor.set(0.5, anchor_y);
          model.position.set(app.screen.width / 2, app.screen.height / 2);
          model.scale.set(scale);
          console.error(app.screen);
          setScreenSize({
            width: canvasele.clientWidth,
            height: canvasele.clientHeight,
          });
          // 添加窗口大小调整监听
          const resizeHandler = () => {
            bg.width = canvasele.clientWidth;
            bg.height = canvasele.clientHeight;
            model.position.set(canvasele.clientWidth / 2, canvasele.clientHeight / 2);
          };

          canvasele.addEventListener('resize', resizeHandler);

          // 设置清理函数
          cleanup = () => {
            canvasele.removeEventListener('resize', resizeHandler);
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
  }, [scriptLoaded, enabled]);
  // 新增自动追踪触发效果
  useEffect(() => {
    if (!enabled) {
      if (trackingRef.current !== null) {
        cancelAnimationFrame(trackingRef.current);
      }
      trackingRef.current = null;
      setTrackingActive(false);
      return;
    }
    if (detectorReady && modelRef.current && videoRef.current && !trackingActive) {
      console.warn('开始自动追踪');
      startFaceTracking(modelRef.current, videoRef.current);
      // const canvasElement = document.getElementById('virtual_role_canvas') as HTMLCanvasElement;
      // if (!canvasElement) return;
      // // 创建虚拟摄像头流
      // const setupVirtualStream = async () => {
      //   const virtualStream = await createVirtualCameraStream(canvasElement);
      //   console.log('获取虚拟流', onVirtualStreamReady);

      //   if (virtualStream && onVirtualStreamReady) {
      //     console.log('虚拟角色流创建成功，准备发送到LiveKit');
      //     onVirtualStreamReady(virtualStream);
      //   }
      // };

      // setupVirtualStream();
    }
    return () => {
      // 清理虚拟流
      if (onVirtualStreamReady) {
        onVirtualStreamReady(null);
      }
      if (trackingRef.current !== null) {
        console.log('清理面部追踪');
        cancelAnimationFrame(trackingRef.current);
      }
      trackingRef.current = null;
      setTrackingActive(false);
    };
  }, [detectorReady, modelRef.current, videoRef.current, enabled, trackingActive]);

  return (
    <div ref={containerRef} className={styles.virtual_role}>
      {isLoading && <div className={styles.virtual_role_msgbox}>虚拟角色加载中...</div>}
      <canvas
        id="virtual_role_canvas"
        style={{ height: '100%', width: '100%', position: 'absolute' }}
      ></canvas>
    </div>
  );
};

export default Live2DComponent;

//创建虚拟视频流
const createVirtualCameraStream = async (canvasElement: HTMLCanvasElement) => {
  if (!canvasElement) return null;

  try {
    // 将canvas转换为媒体流
    const stream = canvasElement.captureStream(24); // 24 FPS
    return stream;
  } catch (err) {
    console.error('创建虚拟摄像头流失败:', err);
    return null;
  }
};
