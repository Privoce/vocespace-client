'use client';

import * as React from 'react';
import { ParticipantPlaceholder } from '@livekit/components-react';
import { Button, Modal, Radio, Slider, Space, Typography } from 'antd';
import type { ParticipantAvoParams } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';
import type p5 from 'p5';

const { Text } = Typography;

let p5Loader: Promise<{ default: typeof p5 }> | null = null;

async function loadP5Module() {
  if (!p5Loader) {
    p5Loader = import('p5');
  }
  return p5Loader;
}

export const AVO_STYLES: ParticipantAvoParams['style'][] = ['blob', 'ring', 'wave'];
export const AVO_STYLE_LABELS: Record<ParticipantAvoParams['style'], string> = {
  blob: 'Blob',
  ring: 'Orbit',
  wave: 'Pulse',
};
export const AVO_PALETTE = [193, 214, 235, 172, 151, 43, 13, 343];

function clampEnergy(value: number) {
  return Math.max(0.1, Math.min(1, Number.isFinite(value) ? value : 0.6));
}

function isValidStyle(value: string): value is ParticipantAvoParams['style'] {
  return AVO_STYLES.includes(value as ParticipantAvoParams['style']);
}

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

  return {
    ...fallback,
    ...(avo || {}),
    name: avo?.name || fallback.name,
    hue: AVO_PALETTE.includes(Number((avo || {}).hue)) ? Number((avo || {}).hue) : fallback.hue,
    style: isValidStyle(String((avo || {}).style)) ? (avo || {}).style! : fallback.style,
    energy: clampEnergy(Number((avo || {}).energy ?? fallback.energy)),
  };
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
  destroy: () => void;
}

async function mountAvoRuntime(
  container: HTMLElement,
  opts: {
    params: ParticipantAvoParams;
    getLevel?: () => number;
    interactive?: boolean;
    scale?: number;
  },
): Promise<AvoHandle> {
  // 仅移除容器内的 canvas 元素，不触碰 React 渲染的内容（如 ParticipantPlaceholder）
  container.querySelectorAll('canvas').forEach((el) => el.remove());

  const p5Module = await loadP5Module();
  const P5Ctor = p5Module.default;

  let params = { ...opts.params };
  const getLevel = opts.getLevel ?? (() => 0);
  const scale = opts.scale ?? 0.62;
  const interactive = opts.interactive ?? false;
  let pointerInside = false;
  let pointerX = 0;
  let pointerY = 0;
  let popAt = -10;

  const sketch = new P5Ctor((p: p5) => {
    const resize = () => {
      const width = container.clientWidth || 160;
      const height = container.clientHeight || 160;
      p.resizeCanvas(width, height);
    };

    p.setup = () => {
      p.createCanvas(container.clientWidth || 160, container.clientHeight || 160);
      p.noStroke();
    };

    p.windowResized = resize;

    p.mouseMoved = () => {
      if (!interactive) return;
      pointerInside = p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
      pointerX = p.mouseX;
      pointerY = p.mouseY;
    };

    (p as any).mouseOut = () => {
      pointerInside = false;
    };

    p.mousePressed = () => {
      if (interactive) {
        popAt = p.millis() / 1000;
      }
    };

    p.draw = () => {
      const width = p.width;
      const height = p.height;
      const minSide = Math.min(width, height);
      const level = Math.max(0, Math.min(1, getLevel()));
      const t = p.millis() / 1000;
      const pop = Math.max(0, 1 - (t - popAt) * 2.4);
      const breath = Math.sin(t * 1.7 + params.variant * 0.0005) * 0.02;
      const radius =
        minSide *
        scale *
        (0.74 + params.energy * 0.06 + level * params.energy * 0.16 + breath + pop * 0.05);

      p.clear();
      p.push();
      p.translate(width / 2, height / 2);

      const dx = pointerInside ? (pointerX - width / 2) / width : 0;
      const dy = pointerInside ? (pointerY - height / 2) / height : 0;
      p.translate(dx * 18, dy * 12 - pop * 8);

      p.colorMode(p.HSB, 360, 100, 100, 1);
      p.fill(params.hue, 64, 96, 0.18 + level * 0.12);
      p.circle(0, 0, radius * 1.42);

      if (params.style === 'blob') {
        p.fill(params.hue, 58, 74, 1);
        p.beginShape();
        for (let angle = 0; angle <= 360; angle += 12) {
          const rad = p.radians(angle);
          const wobble =
            1 + Math.sin(rad * 3 + t * 1.6 + params.variant * 0.001) * (0.05 + level * 0.12);
          p.curveVertex(
            Math.cos(rad) * radius * 0.52 * wobble,
            Math.sin(rad) * radius * 0.52 * wobble,
          );
        }
        p.endShape(p.CLOSE);
      } else if (params.style === 'ring') {
        p.fill(params.hue, 52, 75, 1);
        p.circle(0, 0, radius * 0.68);
        for (let index = 0; index < 10; index += 1) {
          const orbit = t * (0.7 + params.energy) + index * ((Math.PI * 2) / 10);
          const orbitRadius = radius * (0.44 + Math.sin(t * 0.6 + index) * 0.02);
          p.fill(params.hue, 42, 98, 0.9);
          p.circle(
            Math.cos(orbit) * orbitRadius,
            Math.sin(orbit) * orbitRadius,
            radius * 0.08 + level * 5,
          );
        }
      } else {
        p.fill(params.hue, 56, 76, 1);
        p.circle(0, 0, radius * 0.62);
        for (let index = 0; index < 3; index += 1) {
          p.noFill();
          p.stroke(params.hue, 42, 98, 0.65 - index * 0.16);
          p.strokeWeight(4 - index);
          const waveRadius = radius * (0.7 + index * 0.14 + ((t * 40 + index * 12) % 24) / 120);
          p.arc(0, 0, waveRadius, waveRadius, p.PI * 0.08, p.PI * 0.92);
        }
        p.noStroke();
      }

      const eyeOffset = radius * 0.14;
      const eyeSize = radius * 0.08;
      const mouthOpen = radius * (0.02 + level * params.energy * 0.08 + pop * 0.02);
      const lookX = pointerInside ? dx * radius * 0.06 : 0;
      const lookY = pointerInside ? dy * radius * 0.04 : 0;

      p.fill(0, 0, 100, 0.95);
      p.circle(-eyeOffset, -radius * 0.05, eyeSize);
      p.circle(eyeOffset, -radius * 0.05, eyeSize);
      p.fill(params.hue, 45, 18, 1);
      p.circle(-eyeOffset + lookX, -radius * 0.05 + lookY, eyeSize * 0.4);
      p.circle(eyeOffset + lookX, -radius * 0.05 + lookY, eyeSize * 0.4);

      p.fill(params.hue, 36, 18, 0.92);
      p.ellipse(0, radius * 0.12, radius * 0.16, radius * 0.06 + mouthOpen);
      p.pop();
    };
  }, container);

  return {
    setParams(nextParams) {
      params = normalizeAvoParams(
        {
          ...params,
          ...nextParams,
        },
        nextParams.name || params.name,
      );
    },
    destroy() {
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
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  fallbackToPlaceholder?: boolean;
}

export function ParticipantAvoPlaceholder({
  name,
  avo,
  audioLevel = 0,
  interactive = false,
  className,
  style,
  fallbackToPlaceholder = true,
}: ParticipantAvoPlaceholderProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const handleRef = React.useRef<{
    setParams: (params: Partial<ParticipantAvoParams>) => void;
    destroy: () => void;
  } | null>(null);
  const levelRef = React.useRef(audioLevel);
  const [ready, setReady] = React.useState(false);
  const hasAvo = hasCustomAvoParams(avo);

  levelRef.current = audioLevel;

  const params = React.useMemo(() => normalizeAvoParams(avo, name), [avo, name]);

  function safeDestroy() {
    try {
      handleRef.current?.destroy();
    } catch {
      // 忽略 destroy 中的任何错误
    }
  }

  React.useEffect(() => {
    if (!hasAvo && fallbackToPlaceholder) {
      safeDestroy();
      handleRef.current = null;
      setReady(false);
      return;
    }

    let cancelled = false;

    const mountAvo = async () => {
      try {
        if (cancelled || !containerRef.current) {
          return;
        }

        safeDestroy();
        handleRef.current = await mountAvoRuntime(containerRef.current, {
          params,
          getLevel: () => levelRef.current,
          interactive,
          scale: 0.62,
        });
        handleRef.current.setParams(params);
        setReady(true);
      } catch (error) {
        console.error('Failed to mount Avo placeholder:', error);
      }
    };

    void mountAvo();

    return () => {
      cancelled = true;
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

  return (
    <div
      ref={containerRef}
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
      {(!ready || (fallbackToPlaceholder && !hasAvo)) && <ParticipantPlaceholder />}
    </div>
  );
}

function randomizeAvo(name: string): ParticipantAvoParams {
  return {
    name: name || 'guest',
    variant: Math.floor(Math.random() * 1_000_000),
    hue: AVO_PALETTE[Math.floor(Math.random() * AVO_PALETTE.length)],
    style: AVO_STYLES[Math.floor(Math.random() * AVO_STYLES.length)],
    energy: Math.round((0.4 + Math.random() * 0.5) * 20) / 20,
  };
}

export interface ParticipantAvoEditorModalProps {
  open: boolean;
  name: string;
  avo?: Partial<ParticipantAvoParams>;
  saving?: boolean;
  onCancel: () => void;
  onSave: (params: ParticipantAvoParams) => void | Promise<void>;
}

export function ParticipantAvoEditorModal({
  open,
  name,
  avo,
  saving = false,
  onCancel,
  onSave,
}: ParticipantAvoEditorModalProps) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState<ParticipantAvoParams>(() =>
    normalizeAvoParams(avo, name),
  );
  const previewKey = React.useMemo(
    () => `${draft.variant}:${draft.hue}:${draft.style}:${draft.energy}`,
    [draft.energy, draft.hue, draft.style, draft.variant],
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(normalizeAvoParams(avo, name));
  }, [avo, name, open]);

  return (
    <Modal
      title={t('avo.title')}
      open={open}
      width={900}
      okText={t('dashboard.save')}
      cancelText={t('common.cancel')}
      confirmLoading={saving}
      onOk={() => {
        void onSave(normalizeAvoParams(draft, draft.name || name));
      }}
      onCancel={onCancel}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <div>
          <div
            style={{
              height: 320,
              borderRadius: 16,
              background: 'radial-gradient(circle at 20% 20%, #213746, #12181d 65%)',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <ParticipantAvoPlaceholder
              key={previewKey}
              name={draft.name}
              avo={draft}
              interactive
              fallbackToPlaceholder={false}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <Text strong>{t('avo.style')}</Text>
            <div style={{ marginTop: 8 }}>
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                value={draft.style}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    style: event.target.value as ParticipantAvoParams['style'],
                  }))
                }
              >
                {AVO_STYLES.map((style) => (
                  <Radio.Button key={style} value={style}>
                    {t(`avo.styles.${style}`)}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </div>
          </div>

          <div>
            <Text strong>{t('avo.color')}</Text>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 12,
                marginTop: 8,
              }}
            >
              {AVO_PALETTE.map((hue) => {
                const active = draft.hue === hue;
                return (
                  <button
                    key={hue}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, hue }))}
                    style={{
                      height: 42,
                      borderRadius: 999,
                      border: active ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.12)',
                      background: `hsl(${hue} 72% 62%)`,
                      boxShadow: active ? '0 0 0 2px rgba(34, 204, 238, 0.5)' : 'none',
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <Text strong>{t('avo.energy')}</Text>
            <div style={{ marginTop: 8 }}>
              <Slider
                min={0.1}
                max={1}
                step={0.05}
                value={draft.energy}
                onChange={(value) => setDraft((prev) => ({ ...prev, energy: Number(value) }))}
              />
            </div>
          </div>

          <Space>
            <Button onClick={() => setDraft((prev) => randomizeAvo(prev.name || name || 'guest'))}>
              {t('avo.shuffle')}
            </Button>
            <Button
              onClick={() => setDraft(normalizeAvoParams(undefined, draft.name || name || 'guest'))}
            >
              {t('avo.reset')}
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
}
