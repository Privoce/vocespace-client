'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// 动态导入 Live2D 组件，禁用 SSR
const Live2DComponent = dynamic(() => import('./virtual_role'), {
  ssr: false,
  loading: () => <div className="loading-live2d">正在准备虚拟角色...</div>
});

export function VirtualRoleCanvas() {
  return <Live2DComponent />;
}

export default VirtualRoleCanvas;