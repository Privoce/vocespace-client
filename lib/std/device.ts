import { Track } from 'livekit-client';
import { SizeNum } from '.';
import { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce, useThrottle } from './debounce';
import { ChildRoom } from './space';
export interface Device {
  value: string;
  label: string;
}

export interface MouseMove {
  space: string;
  x: number;
  y: number;
  name: string;
  color: string;
  timestamp: number;
  realVideoRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface WsBase {
  space: string; // 房间名
}

export interface WsParticipant extends WsBase {
  participantId: string; // 参与者ID
}

export interface WsRemove extends WsBase {
  participants: string[]; // 参与者ID列表
  childRoom: string; // 子房间名
  socketIds: string[]; // 参与者的socket ID列表
}

export interface WsSender extends WsBase {
  senderName: string;
  senderId: string;
}

export interface WsTo extends WsSender {
  receiverId: string;
  socketId: string;
}

export interface WsWave extends WsTo {
  childRoom?: ChildRoom;
  /**
   * 发送的用户在主空间中
   */
  inSpace?: boolean;
}

export interface WsMouseMove extends MouseMove, WsTo {}

export interface WsJoinRoom extends WsTo {
  childRoom: string;
  confirm?: boolean; // 是否确认加入
}

export interface WsInviteDevice extends WsTo {
  device: Track.Source;
  isOpen: boolean;
}

export enum ControlType {
  ChangeName = 'change_name',
  MuteAudio = 'mute_audio',
  MuteVideo = 'mute_video',
  MuteScreen = 'mute_screen',
  Volume = 'volume',
  BlurVideo = 'blur_video',
  BlurScreen = 'blur_screen',
  Transfer = 'transfer',
}

export interface WsControlParticipant extends WsTo {
  type: ControlType;
  username?: string;
  volume?: number; // 音量调节
  blur?: number; // 视频或屏幕模糊度
}

export interface LiveKitDevice {
  deviceId: string;
  kind: MediaDeviceKind;
  label: string;
  groupId: string;
}

export enum MediaDeviceKind {
  AudioInput = 'audioinput',
  AudioOutput = 'audiooutput',
  VideoInput = 'videoinput',
}

export interface AddDeviceInfo {
  microphone: {
    enabled: boolean;
    self: number;
    other: number;
  };
  video: {
    enabled: boolean;
    blur: number;
  };
  screen: {
    enabled: boolean;
    blur: number;
  };
}

export const default_device = (): AddDeviceInfo => {
  return {
    microphone: {
      enabled: false,
      self: 100,
      other: 20,
    },
    video: {
      enabled: false,
      blur: 0.15,
    },
    screen: {
      enabled: false,
      blur: 0.15,
    },
  };
};

export interface ToggleProps {
  enabled: boolean;
  onClicked: (enabled: boolean) => void;
  showText?: boolean;
  controlWidth: number;
}

/// 计算视频模糊度
/// video_blur是视频模糊度, size是视频大小, 需要根据size来计算相对模糊度
/// 对于传入的video_blur的范围是0.0 ~ 1.0, 0.0表示不模糊, 1.0表示最大模糊
/// 返回最长边的模糊度(px)
export function count_video_blur(video_blur: number, size: SizeNum): number {
  const { height, width } = size;
  const h_blur = (height / 10.0) * video_blur;
  const w_blur = (width / 10.0) * video_blur;
  // console.warn(h_blur, w_blur, height, width);

  return Math.max(h_blur, w_blur);
}

export interface ScreenFocus {
  track_ref?: TrackReferenceOrPlaceholder;
  video_blur?: number;
}

export interface UseVideoBlurProps {
  videoRef: React.RefObject<HTMLVideoElement> | React.RefObject<HTMLImageElement>;
  initialBlur?: number;
  defaultDimensions?: SizeNum;
}

export function useVideoBlur({
  videoRef,
  initialBlur = 0,
  defaultDimensions = { width: 120, height: 100 },
}: UseVideoBlurProps) {
  const [videoBlur, setVideoBlur] = useState(initialBlur);
  const [dimensions, setDimensions] = useState<SizeNum>(defaultDimensions);

  // 使用防抖处理尺寸更新
  const debouncedDimensions = useDebounce(dimensions, 100);

  // 使用节流处理模糊值更新
  const throttledVideoBlur = useThrottle(videoBlur, 16); // 约60fps

  const updateDimensions = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // 只在尺寸真正变化时更新
    const newWidth = videoElement.clientWidth || defaultDimensions.width;
    const newHeight = videoElement.clientHeight || defaultDimensions.height;

    if (newWidth !== dimensions.width || newHeight !== dimensions.height) {
      setDimensions({
        width: newWidth,
        height: newHeight,
      });
    }
  }, [defaultDimensions, dimensions, videoRef]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateDimensions);
    });

    resizeObserver.observe(videoElement);
    videoElement.addEventListener('loadedmetadata', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      videoElement.removeEventListener('loadedmetadata', updateDimensions);
    };
  }, [updateDimensions]);

  // 使用 useMemo 缓存计算结果，并使用防抖和节流后的值
  const blurValue = useMemo(() => {
    return count_video_blur(throttledVideoBlur, debouncedDimensions);
  }, [throttledVideoBlur, debouncedDimensions]);

  const handleSetVideoBlur = useCallback((value: number) => {
    setVideoBlur(value);
  }, []);

  return {
    blurValue,
    dimensions: debouncedDimensions,
    setVideoBlur: handleSetVideoBlur,
  };
}

export enum State {
  Start,
  Stop,
}

export const loadVideo = async (videoRef: RefObject<HTMLVideoElement>) => {
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

    // console.log('视频元数据加载完成');
    await videoRef.current.play();
    // console.log(
    //   '视频开始播放，视频尺寸:',
    //   videoRef.current.videoWidth,
    //   'x',
    //   videoRef.current.videoHeight,
    // );

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

    // console.log(
    //   '视频准备完成，尺寸确认:',
    //   videoRef.current.videoWidth,
    //   'x',
    //   videoRef.current.videoHeight,
    // );
  } catch (err) {
    console.error('Failed to initialize video:', err);
  }
};
