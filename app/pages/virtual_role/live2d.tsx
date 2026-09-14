'use client';

import React, { RefObject } from 'react';
import dynamic from 'next/dynamic';
import { ModelBg, ModelRole } from '@/features/avatars/model';
import { TrackReference } from '@livekit/components-react';
import { MessageInstance } from 'antd/es/message/interface';

// 动态导入 Live2D 组件，禁用 SSR
const Live2DComponent = dynamic(() => import('./virtual_role'), {
  ssr: false,
  loading: () => <div className="loading-live2d">正在准备虚拟角色...</div>,
});

export function VirtualRoleCanvas(props: VirtualRoleProps) {
  return <Live2DComponent {...props} />;
}

export default VirtualRoleCanvas;

export interface VirtualRoleProps {
  video_ele?: RefObject<HTMLVideoElement>;
  model_role: ModelRole;
  model_bg: ModelBg;
  enabled: boolean;
  trackRef?: TrackReference,
  messageApi: MessageInstance,
  isLocal: boolean,
  isReplace: boolean,
  onReady:() => void;
  onDestroy:() => void;
}
