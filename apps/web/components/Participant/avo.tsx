'use client';
import { Creature, normalizeAvo, type CreaturePointer } from '@vocespace/meeting-core';
import { avoStyles, avoPalette } from '@vocespace/meeting-core';

import * as React from 'react';
import { ParticipantPlaceholder } from '@livekit/components-react';
import type { ParticipantAvoParams } from '@/lib/std/space';
import type p5 from 'p5';

let p5Loader: Promise<{ default: typeof p5 }> | null = null;

async function loadP5Module() {
  if (!p5Loader) {
    p5Loader = import('p5');
  }
  return p5Loader;
}

export const AVO_STYLES: ParticipantAvoParams['style'][] = [...avoStyles];
export const AVO_STYLE_LABELS: Record<ParticipantAvoParams['style'], string> = {
  blob: 'Blob',
  ring: 'Orbit',
  wave: 'Pulse',
};
export const AVO_PALETTE: number[] = [...avoPalette];

export function normalizeAvoParams(
  avo: Partial<ParticipantAvoParams> | undefined,
  name: string,
): ParticipantAvoParams {
  const fallback: ParticipantAvoParams = {
    name: name || 'guest',
    variant: 0,
    hue: 193,
    style: 'blob',
    energy: 0.6,
    isUsed: false,
    enabled: true,
  };

  if (typeof window !== 'undefined' && (window as any).Avo?.normalizeParams) {
    try {
      return (window as any).Avo.normalizeParams({
        ...fallback,
        ...(avo || {}),
        name: avo?.name || fallback.name,
      });
    } catch (_error) {
      return {
        ...fallback,
        ...(avo || {}),
        name: avo?.name || fallback.name,
      };
    }
  }

  return normalizeAvo(avo, name);
}

export function getAvoPrimaryColor(
  avo: Partial<ParticipantAvoParams> | undefined,
  name: string,
): string {
  const params = normalizeAvoParams(avo, name);
  return `hsl(${params.hue} 72% 52%)`;
}

function hasCustomAvoParams(avo: Partial<ParticipantAvoParams> | undefined): boolean {
  if (!avo) {
    return false;
  }

  return (
    typeof avo.variant === 'number' ||
    typeof avo.hue === 'number' ||
    typeof avo.energy === 'number' ||
    typeof avo.style === 'string'
  );
}

interface AvoHandle {
  setParams: (params: Partial<ParticipantAvoParams>) => void;
  setExternalPointer: (pointer: CreaturePointer | null, pointerSpeed?: number) => void;
  triggerRemotePop: () => void;
  destroy: () => void;
}

async function mountAvoRuntime(
  container: HTMLElement,
  opts: {
    params: ParticipantAvoParams;
    getLevel?: () => number;
    getLevelRef?: { current: () => number };
    interactive?: boolean;
    isFocused?: boolean;
    scale?: number;
  },
): Promise<AvoHandle> {
  // 清空容器，确保没有任何残留元素
  container.innerHTML = '';

  const p5Module = await loadP5Module();
  const P5Ctor = p5Module.default;

  let params = { ...opts.params };
  const getLevel = opts.getLevel ?? (() => 0);
  const getLevelRef = opts.getLevelRef;
  const scale = opts.scale ?? 0.62;
  const interactive = opts.interactive ?? false;
  const isFocused = opts.isFocused ?? false;
  const creature = new Creature();
  creature.applyParams(params);
  let externalPointer: CreaturePointer | null = null;
  let externalPointerSpeed = 0;

  let visibilityCleanup: (() => void) | null = null;
  let silentStartTime = 0;
  let smoothLevel = 0;
  let persistLevel = 0; // 缓出用，声音结束后平滑衰减

  const isTopmostPressInsideContainer = (event?: MouseEvent | TouchEvent): boolean => {
    if (!interactive) {
      return false;
    }

    const rect = container.getBoundingClientRect();
    let clientX = -1;
    let clientY = -1;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else if (event instanceof TouchEvent && event.touches[0]) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (event instanceof TouchEvent && event.changedTouches[0]) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    }

    if (clientX < 0 || clientY < 0) {
      return false;
    }

    const insideRect =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;

    if (!insideRect) {
      return false;
    }

    const topElement = document.elementFromPoint(clientX, clientY);
    return !!topElement && container.contains(topElement);
  };

  const sketch = new P5Ctor((p: p5) => {
    p.setup = () => {
      const c = p.createCanvas(container.clientWidth || 160, container.clientHeight || 160);
      p.pixelDensity(1);
      if (interactive && c && c.style) c.style('cursor', 'pointer');

      // 固定 30fps
      p.frameRate(30);

      // Page Visibility API: 页面不可见时停止循环
      const onVisibilityChange = () => {
        if (document.hidden) {
          p.noLoop();
        } else {
          silentStartTime = 0;
          p.loop();
          p.frameRate(30);
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      visibilityCleanup = () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    };

    p.draw = () => {
      p.clear();
      const w = p.width;
      const h = p.height;
      const t = p.millis() / 1000;
      // 优先使用 getLevelRef（实时音视频通道），否则回退到 getLevel
      const rawLevel = Math.max(0, Math.min(1, getLevelRef ? getLevelRef.current() : getLevel()));

      // 音频电平平滑（attack 快 / decay 慢），使动画响应更明显
      smoothLevel += (rawLevel - smoothLevel) * (rawLevel > smoothLevel ? 0.35 : 0.12);

      // 音频静默节流：电平持续 < 0.05 超过 5 秒，降帧至 8fps
      if (smoothLevel < 0.05) {
        if (silentStartTime === 0) {
          silentStartTime = t;
        } else if (t - silentStartTime > 5) {
          p.frameRate(18);
        }
      } else {
        silentStartTime = 0;
        p.frameRate(30);
      }

      // 将平滑电平映射为动画驱动强度：
      // - 低于噪音底噪（0.04）→ 无动画
      // - 超过底噪 → 直接从 0.6 起跳，小声说话也有强烈动画
      const SPEAKING_FLOOR = 0.04;
      const targetLevel =
        smoothLevel <= SPEAKING_FLOOR
          ? 0
          : 0.6 + ((smoothLevel - SPEAKING_FLOOR) / (1 - SPEAKING_FLOOR)) * 0.4;

      // 缓出：声音结束后 persistLevel 缓慢衰减到 0，而非骤停
      persistLevel += (targetLevel - persistLevel) * (targetLevel > persistLevel ? 0.35 : 0.04);

      const inside =
        interactive && p.mouseX >= 0 && p.mouseX <= w && p.mouseY >= 0 && p.mouseY <= h;
      const localPointer = inside ? { x: p.mouseX - w / 2, y: p.mouseY - h / 2 } : null;
      const localPointerSpeed = inside ? p.dist(p.mouseX, p.mouseY, p.pmouseX, p.pmouseY) : 0;
      const pointer = localPointer ?? externalPointer;
      const pointerSpeed = localPointer ? localPointerSpeed : externalPointerSpeed;
      creature.render(p, w / 2, h / 2, Math.min(w, h) * scale, {
        t,
        level: persistLevel,
        pointer,
        pointerSpeed,
      });
    };

    p.mousePressed = (event?: MouseEvent) => {
      if (isTopmostPressInsideContainer(event)) {
        creature.pop();
      }
    };

    p.touchStarted = (event?: TouchEvent) => {
      if (isTopmostPressInsideContainer(event)) {
        creature.pop();
      }
      return false;
    };
  }, container);

  const ro = new ResizeObserver(() => {
    if (container.clientWidth && container.clientHeight) {
      sketch.resizeCanvas(container.clientWidth, container.clientHeight);
    }
  });
  ro.observe(container);

  return {
    setParams(nextParams) {
      params = normalizeAvoParams(
        {
          ...params,
          ...nextParams,
        },
        nextParams.name || params.name,
      );
      creature.applyParams(params);
    },
    setExternalPointer(pointer, pointerSpeed = 0) {
      externalPointer = pointer;
      externalPointerSpeed = pointerSpeed;
    },
    triggerRemotePop() {
      creature.pop();
      creature.pet();
    },
    destroy() {
      visibilityCleanup?.();
      ro.disconnect();
      try {
        sketch.remove();
      } catch {
        // p5 内部 removeChild 可能在竞态下抛 NotFoundError，忽略即可
      }
    },
  };
}

export interface ParticipantAvoPlaceholderProps {
  name: string;
  avo?: Partial<ParticipantAvoParams>;
  audioLevel?: number;
  participant?: { audioLevel: number };
  interactive?: boolean;
  isFocused?: boolean;
  remotePointer?: { x: number; y: number; speed?: number } | null;
  remotePopKey?: number;
  className?: string;
  style?: React.CSSProperties;
  fallbackToPlaceholder?: boolean;
}

export function ParticipantAvoPlaceholder({
  name,
  avo,
  audioLevel = 0,
  participant,
  interactive = false,
  isFocused = false,
  remotePointer = null,
  remotePopKey,
  className,
  style,
  fallbackToPlaceholder = true,
}: ParticipantAvoPlaceholderProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const handleRef = React.useRef<{
    setParams: (params: Partial<ParticipantAvoParams>) => void;
    setExternalPointer: (pointer: CreaturePointer | null, pointerSpeed?: number) => void;
    triggerRemotePop: () => void;
    destroy: () => void;
  } | null>(null);
  const levelRef = React.useRef(audioLevel);
  const [ready, setReady] = React.useState(false);
  const hasAvo = hasCustomAvoParams(avo);

  levelRef.current = audioLevel;

  // getLevelRef 在每帧被 p5 draw 调用，实时读取 participant.audioLevel
  const getLevelRef = React.useRef<() => number>(() => levelRef.current);
  // 每次渲染时根据 participant 是否存在更新 getter
  getLevelRef.current = participant
    ? () => (participant as { audioLevel: number }).audioLevel ?? 0
    : () => levelRef.current;

  const params = React.useMemo(() => normalizeAvoParams(avo, name), [avo, name]);

  function safeDestroy() {
    try {
      handleRef.current?.destroy();
    } catch {
      // 忽略 destroy 中的任何错误
    }
  }

  // 使用 generation 机制防止异步竞态：每次 effect 重运行时递增世代号，
  // 旧世代的异步 continuation 会检测到世代不匹配并提前退出
  const mountGenRef = React.useRef(0);

  React.useEffect(() => {
    if (!hasAvo && fallbackToPlaceholder) {
      safeDestroy();
      handleRef.current = null;
      setReady(false);
      return;
    }

    const thisGen = ++mountGenRef.current;

    const mountAvo = async () => {
      try {
        if (mountGenRef.current !== thisGen || !containerRef.current) {
          return;
        }

        safeDestroy();
        handleRef.current = await mountAvoRuntime(containerRef.current, {
          params,
          getLevelRef,
          interactive,
          isFocused,
          scale: 0.62,
        });

        // 创建后再次检查，如果已被新世代取代则销毁
        if (mountGenRef.current !== thisGen) {
          safeDestroy();
          handleRef.current = null;
          return;
        }

        handleRef.current.setParams(params);
        setReady(true);
      } catch (error) {
        console.error('Failed to mount Avo placeholder:', error);
      }
    };

    void mountAvo();

    return () => {
      mountGenRef.current += 1; // 递增世代号以取消当前世代的异步操作
      safeDestroy();
      handleRef.current = null;
    };
  }, [fallbackToPlaceholder, hasAvo, interactive]);

  React.useEffect(() => {
    if (!handleRef.current) {
      return;
    }

    handleRef.current.setParams(params);
  }, [params]);

  React.useEffect(() => {
    if (!handleRef.current || !containerRef.current) {
      return;
    }

    if (!remotePointer) {
      handleRef.current.setExternalPointer(null, 0);
      return;
    }

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    handleRef.current.setExternalPointer(
      {
        x: remotePointer.x * width - width / 2,
        y: remotePointer.y * height - height / 2,
      },
      remotePointer.speed ?? 0,
    );
  }, [remotePointer]);

  React.useEffect(() => {
    if (!handleRef.current || !remotePopKey) {
      return;
    }

    handleRef.current.triggerRemotePop();
  }, [remotePopKey]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      {(!ready || (fallbackToPlaceholder && !hasAvo)) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <ParticipantPlaceholder height={200} />
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </div>
  );
}

export function randomizeAvo(name: string): ParticipantAvoParams {
  return {
    name: name || 'guest',
    variant: Math.floor(Math.random() * 1_000_000),
    hue: AVO_PALETTE[Math.floor(Math.random() * AVO_PALETTE.length)],
    style: AVO_STYLES[Math.floor(Math.random() * AVO_STYLES.length)],
    energy: Math.round((0.4 + Math.random() * 0.5) * 20) / 20,
    isUsed: false,
    enabled: true,
  };
}
