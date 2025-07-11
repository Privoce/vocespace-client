'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

export default function Page() {
  const [percent, setPercent] = React.useState(0);
  const [spinning, setSpinning] = React.useState(false);
  const router = useRouter();

  // 页面加载时自动重定向
  React.useEffect(() => {
    if (percent >= 100) {
      router.push(`/voce_stream?hq=true`);
    } else {
      setSpinning(true);
      // 模拟加载进度
      const interval = setInterval(() => {
        setPercent((prev) => {
          if (prev < 100) {
            return prev + 10;
          } else {
            clearInterval(interval);
            return 100;
          }
        });
      }, 100);
    }
  }, [router, percent]);

  // 显示一个加载状态，因为会立即重定向
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <Spin spinning={spinning} percent={percent} fullscreen />
    </div>
  );
}
