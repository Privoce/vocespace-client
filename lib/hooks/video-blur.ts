'use client';

import type { SizeNum } from '@/lib/types/common';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce, useThrottle } from '@/lib/hooks/timing';
import { count_video_blur } from '@/lib/utils/blur';
export interface UseVideoBlurProps {
  videoRef: React.RefObject<HTMLVideoElement> | React.RefObject<HTMLImageElement>;
  initialBlur?: number;
  defaultDimensions?: SizeNum;
}

const DEFAULT_DIMENSIONS: SizeNum = { width: 120, height: 100 };

export function useVideoBlur({
  videoRef,
  initialBlur = 0,
  defaultDimensions = DEFAULT_DIMENSIONS,
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

    let animationFrame: number | undefined;
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateDimensions);
    });

    resizeObserver?.observe(videoElement);
    videoElement.addEventListener('loadedmetadata', updateDimensions);

    return () => {
      resizeObserver?.disconnect();
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      videoElement.removeEventListener('loadedmetadata', updateDimensions);
    };
  }, [updateDimensions]);

  // 使用 useMemo 缓存计算结果，并使用防抖和节流后的值
  const blurValue = useMemo(() => {
    return count_video_blur(throttledVideoBlur, debouncedDimensions);
  }, [throttledVideoBlur, debouncedDimensions]);

  return {
    blurValue,
    dimensions: debouncedDimensions,
    setVideoBlur,
  };
}
