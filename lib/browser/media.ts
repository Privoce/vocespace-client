import type { RefObject } from 'react';
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


/**
 * 用户是否连接了耳机
 * @returns {Promise<boolean>} 如果连接了耳机返回true，否则返回false
 */
export async function hasHeadphonesConnected() {
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  const devices = await navigator.mediaDevices.enumerateDevices();
  // 筛选音频输出设备，判断label是否含耳机关键词
  const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
  return audioOutputs.some(d =>
    d.label &&
    !/内建扬声器|内建输出|Built-in Output|Internal Speakers/i.test(d.label)
  );
}
