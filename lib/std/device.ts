import { Track } from 'livekit-client';
import { SizeNum } from '.';
import { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce, useThrottle } from './debounce';
export interface Device {
  value: string;
  label: string;
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
}

/// 计算视频模糊度
/// video_blur是视频模糊度, size是视频大小, 需要根据size来计算相对模糊度
/// 对于传入的video_blur的范围是0.0 ~ 1.0, 0.0表示不模糊, 1.0表示最大模糊
/// 返回最长边的模糊度(px)
export function count_video_blur(video_blur: number, size: SizeNum): number {
  const { height, width } = size;
  const h_blur = (height / 10.0) * video_blur;
  const w_blur = (width / 10.0) * video_blur;
  console.warn(h_blur, w_blur, height, width);

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

