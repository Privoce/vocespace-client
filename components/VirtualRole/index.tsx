'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { MotionSync } from 'live2d-motionsync/stream';
// import * as faceapi from 'face-api.js';
import styles from '@/styles/virtual_role.module.scss';
import { VirtualRoleProps } from './live2d';
import { ModelRole } from '@/lib/std/virtual';
import { src } from '@/lib/std';
import { isTrackReference, useLocalParticipant } from '@livekit/components-react';
import { LocalTrack, LocalTrackPublication, Track } from 'livekit-client';
import { loadVideo } from '@/lib/std/device';
import { useI18n } from '@/lib/i18n/i18n';

export const Live2DComponent = ({
  // video_ele: videoRef,
  model_bg,
  model_role,
  enabled,
  trackRef,
  messageApi,
  isReplace,
  onReady,
  onDestroy
}: VirtualRoleProps) => {
  // [ref] --------------------------------------------------------------------------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasEle = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<any>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const trackingRef = useRef<number | null>(null);
  const fakeVideoRef = useRef<HTMLVideoElement | null>(null);
  const { localParticipant } = useLocalParticipant();
  const [lastDetectionAt, setLastDetectionAt] = useState<number | null>(null);
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);
  const smoothnessFactorRef = useRef(0.25); // 添加平滑过渡因子 (0-1之间，越小越平滑)
  // 存储发布的虚拟轨道
  const originTrackRef = useRef<LocalTrack<Track.Kind> | null>(null);
  const { t } = useI18n();

  // 状态机来控制流程
  const [cState, setCState] = useState<{
    isLoading: boolean;
    error: string | null;
    trackingActive: boolean;
    detectorReady: boolean;
  }>({
    isLoading: true,
    error: null,
    trackingActive: false,
    detectorReady: false,
  });

  const cleanupResources = () => {
    // 清理面部追踪
    if (trackingRef.current != null) {
      cancelAnimationFrame(trackingRef.current);
      trackingRef.current = null;
    }
    // 清理虚拟轨道
    if (originTrackRef.current && localParticipant) {
      try {
        originTrackRef.current.stop();
        originTrackRef.current.restartTrack();
        originTrackRef.current = null;
      } catch (error) {
        console.error('Error unpublishing track:', error);
      }
    }

    // 清理PIXI应用
    // if (appRef.current) {
    //   try {
    //     // 移除所有子元素
    //     if (appRef.current.stage) {
    //       while (appRef.current.stage.children.length > 0) {
    //         const child = appRef.current.stage.children[0];
    //         appRef.current.stage.removeChild(child);
    //         if (child instanceof PIXI.Sprite) {
    //           child.destroy();
    //         }
    //       }
    //     }

    //     // ticker
    //     if (appRef.current.ticker) {
    //       appRef.current.ticker.stop();
    //       appRef.current.ticker.destroy();
    //     }

    //     appRef.current.destroy(true, {
    //       children: true,
    //       texture: true,
    //       baseTexture: true,
    //     });
    //     appRef.current = null;
    //   } catch (e) {
    //     console.error('清理 PIXI 应用出错:', e);
    //   }
    // }

    if (modelRef.current) {
      try {
        if (modelRef.current.destroy) {
          modelRef.current.destroy();
        }
        // 重置模型
        modelRef.current = null;
      } catch (e) {
        console.error('清理模型出错:', e);
      }
    }

    // 恢复状态机
    setCState({
      isLoading: false,
      error: null,
      trackingActive: false,
      detectorReady: false,
    });

    if (fakeVideoRef.current && fakeVideoRef.current.srcObject && isReplace) {
      const stream = fakeVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }

    onDestroy();
  };

  const loadLive2dCore = () => {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).Live2DCubismCore) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src(`/live2d_resources/live2d.min.js`);
      script.async = true;
      script.onload = () => {
        console.log('Live2D 核心脚本加载成功');
        resolve();
      };

      script.onerror = (e) => {
        reject('无法加载 Live2D 核心库');
      };

      document.head.appendChild(script);
      // (window as any).Live2DCubismCore = true;
    });
  };

  const initPixiAndModel = async () => {
    (window as any).PIXI = PIXI;
    const { Live2DModel } = await import('pixi-live2d-display/cubism4');
    Live2DModel.registerTicker(PIXI.Ticker);
    // 确定canvas
    if (!canvasEle.current) {
      throw new Error('Canvas element is not available');
    }

    // 初始化 PIXI 应用
    const app = new PIXI.Application({
      view: canvasEle.current,
      resizeTo: canvasEle.current,
      autoStart: true,
      transparent: true,
    });
    appRef.current = app;
    // 加载模型
    const model = await Live2DModel.from(
      src(`/live2d_resources/${model_role}/${model_role}.model3.json`),
      { autoInteract: false },
    );
    // 加载背景
    const bg = await PIXI.Sprite.from(src(`/images/bg/${model_bg}`));
    bg.width = app.screen.width;
    bg.height = app.screen.height;
    app.stage.addChildAt(bg, 0);
    // 保存模型引用
    modelRef.current = model;
    // 设置口型同步
    const motionSync = new MotionSync(model.internalModel);
    let motion_file = '';
    let anchor_x = 0.5;
    let anchor_y = 0.15;
    let scale = 0.25;
    switch (model_role) {
      case ModelRole.Haru: {
        motion_file = 'haru_g_idle.motion3';
        anchor_y = 0.12;
        scale = 0.16;
        break;
      }
      case ModelRole.Hiyori: {
        motion_file = 'Hiyori_m01.motion3';
        anchor_y = 0.16;
        scale = 0.16;
        break;
      }
      case ModelRole.Mao: {
        motion_file = 'mtn_01.motion3';
        anchor_y = 0.2;
        scale = 0.06;
        break;
      }
      case ModelRole.Mark: {
        motion_file = 'mark_m01.motion3';
        anchor_y = 0.32;
        scale = 0.14;
        break;
      }
      case ModelRole.Natori: {
        motion_file = 'mtn_00.motion3';
        scale = 0.14;
        break;
      }
      case ModelRole.Rice: {
        motion_file = 'mtn_01.motion3';
        anchor_x = 0.65;
        anchor_y = 0.2;
        scale = 0.18;
        break;
      }
    }
    // 这里的数值都是像对于440 * 220的窗口大小，这里需要根据实际窗口大小进行调整
    scale = resize(scale, app.screen.width, app.screen.height);
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
    model.anchor.set(anchor_x, anchor_y);
    model.position.set(app.screen.width / 2, app.screen.height / 2);
    model.scale.set(scale);

    setScreenSize({
      width: app.screen.width,
      height: app.screen.height,
    });
    // 添加窗口大小调整监听
    const resizeHandler = () => {
      bg.width = app.screen.width;
      bg.height = app.screen.height;
      model.position.set(app.screen.width / 2, app.screen.height / 2);
    };
    canvasEle.current.addEventListener('resize', resizeHandler);
    // 更新状态机
    setCState((prev) => ({
      ...prev,
      isLoading: false,
    }));
  };

  const setupVirtualCamera = async () => {
    if (!isTrackReference(trackRef) || !isReplace) return;
    if (trackRef.source !== Track.Source.Camera) return;
    if (trackRef.participant.identity !== localParticipant.identity) return;
    if (!canvasEle.current) return;

    try {
      const cameraPub = localParticipant.getTrackPublication(trackRef.source);
      if (!cameraPub?.track) {
        return;
      }

      // 创建虚拟摄像头流
      const virtualStream = await createVirtualCameraStream(canvasEle.current);
      if (!virtualStream) {
        throw new Error('Failed to create virtual camera stream');
      }
      const originalTrack = cameraPub.track;
      const virtualTrack = virtualStream.getVideoTracks()[0];
      await originalTrack.replaceTrack(virtualTrack);

      // await localParticipant.publishTrack(virtualTrack, {
      //   name:
      // });

      // await localParticipant.unpublishTrack(cameraPub.track);
      // setTimeout(async () => {
      //   console.log('发布虚拟摄像头流');
      //   // await localParticipant.publishTrack(virtualTrack);
      // }, 300);

      originTrackRef.current = originalTrack;
      onReady();
      // console.log('虚拟摄像头流创建成功');
    } catch (error) {
      console.error('虚拟摄像头流构建失败:', error);
      messageApi.error('msg.error.virtual.video_stream');
    }
  };

  // 清理追踪
  const cleanupTracking = () => {
    if (trackingRef.current !== null) {
      cancelAnimationFrame(trackingRef.current);
      trackingRef.current = null;

      setCState((prev) => ({
        ...prev,
        trackingActive: false,
      }));
    }
  };

  // 实现连续头部追踪的函数
  // const startFaceTracking = async () => {
  //   // 防止重复启动
  //   if (!enabled || cState.trackingActive || trackingRef.current !== null) return;
  //   if (!videoRef.current) return;
  //   let realVideoTrack = videoRef.current;
  //   if (fakeVideoRef.current && trackRef) {
  //     console.log('使用虚拟视频流进行追踪');
  //     await loadVideo(fakeVideoRef);
  //     realVideoTrack = fakeVideoRef.current;
  //   }

  //   // 创建追踪函数
  //   const track = async () => {
  //     // 这里如果有trackRef则需要使用fakeVideoRef，因为真实的已经被替换了
  //     if (!realVideoTrack || !modelRef.current || !enabled) {
  //       cleanupTracking();
  //       return;
  //     }
  //     const detection = await faceapi
  //       .detectSingleFace(realVideoTrack, new faceapi.TinyFaceDetectorOptions())
  //       .withFaceLandmarks();
  
  //     // 限制检测频率，减少资源占用
  //     const now = Date.now();
  //     if (!lastDetectionAt || now - lastDetectionAt > 200) {
  //       try {
  //         if (detection) {
  //           // setIsLoading(false);
  //           if (!cState.trackingActive) {
  //             setCState((prev) => ({
  //               ...prev,
  //               trackingActive: true,
  //             }));
  //           }
  //           // 设置追踪状态
  //           const landmarks = detection.landmarks;
  //           const leftEye = landmarks.getLeftEye();
  //           const rightEye = landmarks.getRightEye();
  //           const nose = landmarks.getNose();
  //           // 计算眼睛中心点 (取左右眼和鼻尖三点加权平均)
  //           const leftEyeCenter = {
  //             x: leftEye.reduce((sum, point) => sum + point.x, 0) / leftEye.length,
  //             y: leftEye.reduce((sum, point) => sum + point.y, 0) / leftEye.length,
  //           };

  //           const rightEyeCenter = {
  //             x: rightEye.reduce((sum, point) => sum + point.x, 0) / rightEye.length,
  //             y: rightEye.reduce((sum, point) => sum + point.y, 0) / rightEye.length,
  //           };

  //           const noseTip = nose[nose.length - 1];

  //           // 计算加权中心点 (眼睛位置权重较高)
  //           const centerX = leftEyeCenter.x * 0.35 + rightEyeCenter.x * 0.35 + noseTip.x * 0.3;
  //           const centerY = leftEyeCenter.y * 0.4 + rightEyeCenter.y * 0.4 + noseTip.y * 0.2;

  //           // 归一化坐标 (-1 到 1 的范围)
  //           const normalizedX = (centerX / videoRef!.current!.videoWidth) * 2 - 1;
  //           const normalizedY = (centerY / videoRef!.current!.videoHeight) * 2 - 1;

  //           // 将归一化坐标与ScreenSize结合转为真实坐标
  //           let realX = (normalizedX * screenSize.width) / 2 + screenSize.width / 2;
  //           let realY = (-normalizedY * screenSize.height) / 2 + screenSize.height / 2;

  //           // 添加平滑过渡
  //           if (lastPosition) {
  //             const smoothness = smoothnessFactorRef.current;
  //             realX = lastPosition.x * (1 - smoothness) + realX * smoothness;
  //             realY = lastPosition.y * (1 - smoothness) + realY * smoothness;
  //           }

  //           // 保存当前位置用于下次平滑计算
  //           setLastPosition({ x: realX, y: realY });

  //           // 添加轻微的自然偏移来模拟人眼微动
  //           const microMovementX = Math.sin(Date.now() / 2000) * 5;
  //           const microMovementY = Math.cos(Date.now() / 2500) * 3;
  //           console.log('微动:', realX + microMovementX, realY + microMovementY);
  //           // 应用focus
  //           modelRef.current.focus(realX + microMovementX, realY + microMovementY);
  //         }

  //         setLastDetectionAt(now);
  //       } catch (e) {
  //         console.error('人脸检测过程中出错:', e);
  //       }
  //     }

  //     // 继续下一帧的追踪
  //     if (enabled) {
  //       trackingRef.current = requestAnimationFrame(track);
  //     }
  //   };

  //   // 开始追踪循环
  //   trackingRef.current = requestAnimationFrame(track);
  // };

  useEffect(() => {
    if (!enabled) {
      return cleanupResources();
    }

    let isActive = true;

    const init = async () => {
      try {
        // 加载faceapi需要的模型
        if (!cState.detectorReady) {
          // await faceapi.loadTinyFaceDetectorModel(
          //   src(`/models/tiny_face_detector_model-weights_manifest.json`),
          // );
          // await faceapi.loadFaceLandmarkModel(
          //   src(`/models/face_landmark_68_model-weights_manifest.json`),
          // );
          if (!isActive) return;
          setCState((prev) => ({
            ...prev,
            detectorReady: true,
          }));
        }
        // 加载Live2D核心脚本
        if (!(window as any).Live2DCubismCore) {
          await loadLive2dCore();
          if (!isActive) return;
        }

        // 初始化Pixi和模型
        if (!modelRef.current) {
          await initPixiAndModel();
          if (!isActive) return;
        }
      } catch (error) {
        console.error('初始化失败:', error);
        setCState((prev) => ({
          ...prev,
          error: String(error),
          isLoading: false,
        }));
      }
    };

    init();

    return () => {
      isActive = false;
      cleanupResources();
    };
  }, [enabled]);

  // 添加一个新的 useEffect
  useEffect(() => {
    if (!isReplace) return;

    const startVirtualCamera = async () => {
      if (trackRef) {
        // 设置虚拟摄像头
        await setupVirtualCamera();
      }
    };

    // 只有在有效尺寸、已加载模型、启用状态下才开始追踪
    if (
      screenSize.width > 0 &&
      screenSize.height > 0 &&
      modelRef.current &&
      enabled &&
      !cState.trackingActive
    ) {
      // console.log('屏幕尺寸已更新，开始追踪', screenSize);
      // startFaceTracking(); 暂时停用
      startVirtualCamera();
    }
  }, [screenSize, enabled, cState.trackingActive, isReplace]);

  //创建虚拟视频流
  const createVirtualCameraStream = async (canvasElement: HTMLCanvasElement) => {
    if (!canvasElement) return null;

    try {
      // 将canvas转换为媒体流
      const stream = canvasElement.captureStream(30); // 30 FPS
      return stream;
    } catch (err) {
      console.error('创建虚拟摄像头流失败:', err);
      messageApi.error(t('msg.error.virtual.video_stream'));
      return null;
    }
  };

  return (
    <div ref={containerRef} className={styles.virtual_role}>
      {cState.isLoading && (
        <div className={styles.virtual_role_msgbox}>{t('msg.info.virtual_loading')}</div>
      )}
      <canvas
        ref={canvasEle}
        id="virtual_role_canvas"
        style={{ height: '100%', width: '100%', position: 'absolute' }}
      ></canvas>
      {trackRef && (
        <video
          ref={fakeVideoRef}
          style={{
            height: '100%',
            width: '100%',
            visibility: 'hidden',
          }}
        ></video>
      )}
    </div>
  );
};

export default Live2DComponent;

const resize = (value: number, width: number, height: number): number => {
  return value * Math.min(width / 440, height / 212);
};
