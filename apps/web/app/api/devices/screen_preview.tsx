import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '@/styles/pre_join.module.scss';
import { src } from '@/lib/std';

interface ScreenPreviewProps {
  enabled: boolean;
  blur: number;
  onClose: () => void;
  onError?: (error: Error) => void;
}

export function ScreenPreview({ enabled, blur, onError, onClose }: ScreenPreviewProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startScreenShare = useCallback(async () => {
    if (isRequesting) {
      return;
    }
    try {
      setIsRequesting(true);
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      if (!videoRef?.current?.srcObject) {
        setStream(mediaStream);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // 监听用户停止分享
      mediaStream.getVideoTracks()[0].onended = () => {
        setStream(null);
        setIsRequesting(false);
        onClose();
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };
    } catch (error) {
      onError?.(error as Error);
    }
  }, [onError]);

  const stopScreenShare = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsRequesting(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  // 监听开启/关闭
  useEffect(() => {
    if (isRequesting) {
      return;
    }

    if (enabled) {
      startScreenShare();
    } else {
      stopScreenShare();
    }
  }, [enabled, startScreenShare, stopScreenShare]);

  return (
    <>
      {enabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain', filter: `blur(${blur}px)` }}
        />
      ) : (
        <div className={styles['pre_join_main_device_right_video_empty']}>
          <img height={48} src={src('/images/vocespace.svg')} alt="" />
          <p>Screen Share</p>
        </div>
      )}
    </>
  );
}
