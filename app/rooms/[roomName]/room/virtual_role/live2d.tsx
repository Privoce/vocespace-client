'use client';

import React, { RefObject } from 'react';
import dynamic from 'next/dynamic';
import { ModelBg, ModelRole } from '@/lib/std/virtual';

// 动态导入 Live2D 组件，禁用 SSR
const Live2DComponent = dynamic(() => import('./virtual_role'), {
  ssr: false,
  loading: () => <div className="loading-live2d">正在准备虚拟角色...</div>,
});

export function VirtualRoleCanvas({ video_ele }: VirtualRoleProps) {
  return <Live2DComponent video_ele={video_ele} />;
}

export default VirtualRoleCanvas;

export interface VirtualRoleProps {
  video_ele: RefObject<HTMLVideoElement>;
}
