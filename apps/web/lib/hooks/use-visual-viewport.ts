'use client';
import { useEffect, useState } from 'react';

/** Mobile keyboards resize the visual viewport without resizing the layout viewport. */
export function useVisualViewport(enabled: boolean) {
  const [viewport, setViewport] = useState<{height: number; top: number} | null>(null);
  useEffect(() => {
    if (!enabled || !window.visualViewport) return;
    const visual = window.visualViewport;
    const update = () => setViewport({height: visual.height, top: visual.offsetTop});
    update();
    visual.addEventListener('resize', update);
    visual.addEventListener('scroll', update);
    return () => {
      visual.removeEventListener('resize', update);
      visual.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return enabled ? viewport : null;
}
