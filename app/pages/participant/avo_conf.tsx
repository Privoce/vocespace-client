'use client';

import * as React from 'react';
import { Button, Modal, Radio, Slider, Space, Typography } from 'antd';
import type { ParticipantAvoParams } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';
import {
  ParticipantAvoPlaceholder,
  normalizeAvoParams,
  AVO_STYLES,
  AVO_PALETTE,
  randomizeAvo,
} from './avo';

const { Text } = Typography;

export interface AvoConfigPanelProps {
  /** 整体布局方向 */
  direction: 'horizontal' | 'vertical';
  name: string;
  avo?: Partial<ParticipantAvoParams>;
  saving?: boolean;
  onSave: (params: ParticipantAvoParams) => void | Promise<void>;
}

export function AvoConfigPanel({
  direction,
  name,
  avo,
  saving = false,
  onSave,
}: AvoConfigPanelProps) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState<ParticipantAvoParams>(() =>
    normalizeAvoParams(avo, name),
  );
  const previewKey = React.useMemo(
    () => `${draft.variant}:${draft.hue}:${draft.style}:${draft.energy}`,
    [draft.energy, draft.hue, draft.style, draft.variant],
  );

  // 从外部同步 draft
  React.useEffect(() => {
    setDraft(normalizeAvoParams(avo, name));
  }, [avo, name]);

  const previewSection = (
    <div>
      <div
        style={{
          height: direction === 'horizontal' ? 320 : 240,
          borderRadius: 16,
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
  );

  const controlsSection = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 样式 */}
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

      {/* 颜色 */}
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

      {/* 能量 */}
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

      {/* 底部操作栏 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
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
        <div style={{ flex: 1 }} />
        <Button
          type="primary"
          loading={saving}
          onClick={() => onSave(normalizeAvoParams(draft, draft.name || name))}
        >
          {t('dashboard.save')}
        </Button>
      </div>
    </div>
  );

  if (direction === 'horizontal') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {previewSection}
        {controlsSection}
      </div>
    );
  }

  // vertical 纵向布局
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {previewSection}
      {controlsSection}
    </div>
  );
}

// ----------------------------------------------------------------
// 原来的 Modal，使用 AvoConfigPanel（横向），footer 由 panel 内 save 按钮处理
// ----------------------------------------------------------------

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
  return (
    <Modal
      title={useI18n().t('avo.title')}
      open={open}
      width={900}
      footer={null}
      onCancel={onCancel}
    >
      <AvoConfigPanel
        direction="horizontal"
        name={name}
        avo={avo}
        saving={saving}
        onSave={onSave}
      />
    </Modal>
  );
}
