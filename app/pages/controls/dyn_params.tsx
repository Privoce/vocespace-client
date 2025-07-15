'use client';

import { useEffect, useState } from 'react';
import { TrackReferenceOrPlaceholder, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Descriptions, DescriptionsProps } from 'antd';

interface ClientParams {
  screenResolution: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  videoTrack: {
    resolution: string;
    bitrate: number;
    framerate: number;
  } | null;
}

export function DynParams({ track }: { track: TrackReferenceOrPlaceholder }) {
  const [params, setParams] = useState<ClientParams>({
    screenResolution: {
      width: 0,
      height: 0,
      devicePixelRatio: 1,
    },
    videoTrack: null,
  });

  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    // 获取屏幕分辨率
    const updateScreenResolution = () => {
      setParams((prev) => ({
        ...prev,
        screenResolution: {
          width: window.screen.width,
          height: window.screen.height,
          devicePixelRatio: window.devicePixelRatio || 1,
        },
      }));
    };

    updateScreenResolution();

    // 监听屏幕变化
    window.addEventListener('resize', updateScreenResolution);

    return () => {
      window.removeEventListener('resize', updateScreenResolution);
    };
  }, []);

  useEffect(() => {
    if (!localParticipant) return;

    const updateTrackStats = async () => {
      // 获取视频轨道统计

      if (track.source === Track.Source.ScreenShare || track.source === Track.Source.Camera) {
        try {
          // const stats = await videoTrack.track.getRTCStatsReport();
          const stats = await track.publication?.videoTrack?.getRTCStatsReport();

          if (!stats) return;
          let videoStats: any = null;

          stats.forEach((report) => {
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              const resolution = `${report.frameWidth || 0}x${report.frameHeight || 0}`;
              videoStats = {
                resolution,
                bitrate: Math.round((report.bytesSent * 8) / (report.timestamp / 1000)) || 0,
                framerate: report.framesPerSecond || 0,
              };
            }
          });

          setParams((prev) => ({
            ...prev,
            videoTrack: videoStats,
          }));
        } catch (error) {
          console.error('Failed to get video track stats:', error);
        }
      }
    };

    // 定期更新统计信息
    const interval = setInterval(updateTrackStats, 100000);

    return () => {
      clearInterval(interval);
    };
  }, [localParticipant]);

  const items: DescriptionsProps['items'] = [
    {
      label: '屏幕分辨率',
      children: `${params.screenResolution.width} x ${params.screenResolution.height}`,
    },
    {
      label: '视频分辨率',
      children: params.videoTrack ? params.videoTrack.resolution : '无',
    },
    {
      label: '码率',
      children: params.videoTrack ? `${(params.videoTrack.bitrate / 1000).toFixed(1)} kbps` : '无',
    },
    {
      label: '帧率',
      children: params.videoTrack ? `${params.videoTrack.framerate} fps` : '无',
    },
  ];

  return (
    <Descriptions
      title={undefined}
      bordered
      styles={{
        label: {
          color: '#8c8c8c',
          backgroundColor: '#1a1a1a',
        },
      }}
      column={{ xs: 1, sm: 2, md: 4, lg: 4, xl: 6, xxl: 6 }}
      items={items}
    />
  );
}
