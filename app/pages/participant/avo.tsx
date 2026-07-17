'use client';

import * as React from 'react';
import { ParticipantPlaceholder } from '@livekit/components-react';
import { Button, Modal, Radio, Slider, Space, Typography } from 'antd';
import type { ParticipantAvoParams } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';

const { Text } = Typography;

declare global {
  interface Window {
    Avo?: {
      mount: (
        container: HTMLElement,
        opts: {
          params: ParticipantAvoParams;
          getLevel?: () => number;
          interactive?: boolean;
          scale?: number;
        },
      ) => {
        setParams: (params: Partial<ParticipantAvoParams>) => void;
        destroy: () => void;
      };
      DEFAULTS?: Partial<ParticipantAvoParams>;
      normalizeParams?: (params: Partial<ParticipantAvoParams>) => ParticipantAvoParams;
    };
    __avoAssetLoader__?: Promise<void>;
  }
}

const AVO_P5_SRC = '/avo-main/lib/p5.min.js';
const AVO_WIDGET_SRC = '/avo-main/js/avo.js';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
      once: true,
    });
    document.body.appendChild(script);
  });
}

export async function ensureAvoAssets(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.__avoAssetLoader__) {
    window.__avoAssetLoader__ = (async () => {
      await loadScript(AVO_P5_SRC);
      await loadScript(AVO_WIDGET_SRC);
    })();
  }

  await window.__avoAssetLoader__;
}

export const AVO_STYLES: ParticipantAvoParams['style'][] = ['blob', 'ring', 'wave'];
export const AVO_STYLE_LABELS: Record<ParticipantAvoParams['style'], string> = {
  blob: 'Blob',
  ring: 'Orbit',
  wave: 'Pulse',
};
export const AVO_PALETTE = [193, 214, 235, 172, 151, 43, 13, 343];

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

  if (typeof window !== 'undefined' && window.Avo?.normalizeParams) {
    try {
      return window.Avo.normalizeParams({
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
  const hasAvo = !!avo;

  levelRef.current = audioLevel;

  const params = React.useMemo(() => normalizeAvoParams(avo, name), [avo, name]);

  React.useEffect(() => {
    if (!hasAvo && fallbackToPlaceholder) {
      handleRef.current?.destroy();
      handleRef.current = null;
      setReady(false);
      return;
    }

    let cancelled = false;

    const mountAvo = async () => {
      try {
        await ensureAvoAssets();
        if (cancelled || !containerRef.current || !window.Avo?.mount) {
          return;
        }

        handleRef.current?.destroy();
        handleRef.current = window.Avo.mount(containerRef.current, {
          params,
          getLevel: () => levelRef.current,
          interactive,
          scale: 0.62,
        });
        setReady(true);
      } catch (error) {
        console.error('Failed to mount Avo placeholder:', error);
      }
    };

    void mountAvo();

    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [fallbackToPlaceholder, hasAvo, interactive, params]);

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
        overflow: 'hidden',
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
                onChange={(value) =>
                  setDraft((prev) => ({ ...prev, energy: Number(value) }))
                }
              />
            </div>
          </div>

          <Space>
            <Button
              onClick={() => setDraft((prev) => randomizeAvo(prev.name || name || 'guest'))}
            >
              {t('avo.shuffle')}
            </Button>
            <Button
              onClick={() =>
                setDraft(
                  normalizeAvoParams(undefined, draft.name || name || 'guest'),
                )
              }
            >
              {t('avo.reset')}
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
}