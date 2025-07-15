'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TrackReferenceOrPlaceholder, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Descriptions, DescriptionsProps } from 'antd';
import { EnvConf } from '@/lib/std/env';
import { VocespaceConfig } from '@/lib/std/conf';
import api from '@/lib/api';

export function DynParams({ track }: { track: TrackReferenceOrPlaceholder }) {
  const [params, setParams] = useState<EnvConf | null>(null);
  const env = useRef<VocespaceConfig | null>(null);

  const updateTrackStats = async () => {
    // 获取视频轨道统计
    if (track.source === Track.Source.ScreenShare || track.source === Track.Source.Camera) {
      try {
        const bitrate = track.publication?.videoTrack?.currentBitrate;

        setParams({
          resolution: env.current?.resolution || '1080p',
          maxBitrate: bitrate || 0,
          maxFramerate: env.current?.maxFramerate || 30,
          priority: env.current?.priority || 'high',
        });
      } catch (error) {
        console.error('Failed to get video track stats:', error);
      }
    }
  };

  const getConf = async () => {
    const envData = await api.envConf();
    env.current = envData;
  };

  useEffect(() => {
    if (!track) return;
    if (!env.current) {
      getConf();
    }

    // 定期更新统计信息
    const interval = setInterval(async () => {
      if (track) {
        await updateTrackStats();
      }
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [track, env.current]);

  const items: DescriptionsProps['items'] = useMemo(()=>{
    return [
    {
      label: '视频分辨率',
      children: params?.resolution || '无',
    },
    {
      label: '码率',
      children: params?.maxBitrate ? `${(params.maxBitrate / 1000000).toFixed(1)} Mbps` : '无',
    },
    {
      label: '帧率',
      children: params?.maxFramerate ? `${params.maxFramerate} fps` : '无',
    },
  ];
  }, [params]);

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
