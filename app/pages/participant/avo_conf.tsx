'use client';

import * as React from 'react';
import {
  Button,
  Flex,
  Input,
  Modal,
  Radio,
  Slider,
  Space,
  Typography,
  Upload,
  message,
} from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
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

const basicButtonStyle = {
  width: 'calc(50% - 8px)',
  backgroundColor: 'transparent',
  border: "1px solid #8c8c8c",
  color: "#fff"
};

export interface AvoConfigPanelProps {
  /** 整体布局方向 */
  direction: 'horizontal' | 'vertical';
  name: string;
  avoList?: ParticipantAvoParams[];
  saving?: boolean;
  onSave: (params: ParticipantAvoParams[]) => void | Promise<void>;
}

export function AvoConfigPanel({
  direction,
  name,
  avoList,
  saving = false,
  onSave,
}: AvoConfigPanelProps) {
  const { t } = useI18n();

  // 当前编辑的列表
  const [draftList, setDraftList] = React.useState<ParticipantAvoParams[]>(() => {
    if (avoList && avoList.length > 0) {
      return avoList.map((a) => normalizeAvoParams(a, a.name || name || 'guest'));
    }
    return [normalizeAvoParams(undefined, name || 'guest')];
  });

  // 当前选中的索引
  const [selectedIndex, setSelectedIndex] = React.useState(() => {
    if (avoList && avoList.length > 0) {
      const activeIdx = avoList.findIndex((a) => a.isUsed);
      return activeIdx >= 0 ? activeIdx : 0;
    }
    return 0;
  });

  const selectedAvo = draftList[selectedIndex] ?? draftList[0];

  // 当选中项索引超出范围时复位
  React.useEffect(() => {
    if (selectedIndex >= draftList.length) {
      setSelectedIndex(Math.max(0, draftList.length - 1));
    }
  }, [draftList.length, selectedIndex]);

  // 从外部同步 draftList
  React.useEffect(() => {
    if (avoList && avoList.length > 0) {
      setDraftList(avoList.map((a) => normalizeAvoParams(a, a.name || name || 'guest')));
    }
  }, [avoList, name]);

  const previewKey = React.useMemo(
    () =>
      `${selectedAvo.variant}:${selectedAvo.hue}:${selectedAvo.style}:${selectedAvo.energy}:${selectedAvo.name}`,
    [selectedAvo],
  );

  // 更新当前选中项的字段
  const updateCurrent = React.useCallback(
    (patch: Partial<ParticipantAvoParams>) => {
      setDraftList((prev) => {
        const next = [...prev];
        next[selectedIndex] = { ...next[selectedIndex], ...patch };
        return next;
      });
    },
    [selectedIndex],
  );

  // 添加新项
  const addItem = React.useCallback(() => {
    setDraftList((prev) => [
      ...prev,
      normalizeAvoParams(undefined, selectedAvo.name || name || 'guest'),
    ]);
    setSelectedIndex(draftList.length);
  }, [draftList.length, name, selectedAvo.name]);

  // 删除指定项
  const deleteItem = React.useCallback(
    (idx: number) => {
      setDraftList((prev) => {
        if (prev.length <= 1) return prev; // 至少保留一个
        return prev.filter((_, i) => i !== idx);
      });
      // 如果删除的是当前项，把选中索引复位
      if (idx === selectedIndex) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (idx < selectedIndex) {
        setSelectedIndex((s) => s - 1);
      }
    },
    [selectedIndex],
  );

  // 加载指定项到编辑器（更新选中索引，并标记为当前使用）
  const loadItem = React.useCallback((idx: number) => {
    setSelectedIndex(idx);
    setDraftList((prev) =>
      prev.map((item, i) => ({ ...item, isUsed: i === idx })),
    );
  }, []);

  // 导出 JSON
  const handleExport = React.useCallback(() => {
    const json = JSON.stringify(draftList, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = 'avo_presets.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [draftList]);

  // 导入 JSON
  const handleImport = React.useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (!Array.isArray(parsed)) {
            message.warning(t('avo.importInvalid') || 'Invalid format, expected an array');
            return;
          }
          const normalized = parsed.map((a: Partial<ParticipantAvoParams>) =>
            normalizeAvoParams(a, a.name || name || 'guest'),
          );
          setDraftList(normalized);
          setSelectedIndex(0);
          message.success(t('avo.importSuccess') || 'Imported successfully');
        } catch {
          message.warning(t('avo.importInvalid') || 'Invalid JSON file');
        }
      };
      reader.readAsText(file);
      return false; // 阻止 Upload 默认提交
    },
    [name, t],
  );

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
          name={selectedAvo.name}
          avo={selectedAvo}
          interactive
          fallbackToPlaceholder={false}
        />
      </div>
      {/* Display Name 输入框 */}
      <div style={{ marginTop: 12 }}>
        <Text strong>{t('avo.displayName') || 'Display Name'}</Text>
        <Input
          size="large"
          value={selectedAvo.name}
          onChange={(e) => updateCurrent({ name: e.target.value })}
          placeholder={name || 'guest'}
          style={{ marginTop: 6 }}
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
            value={selectedAvo.style}
            onChange={(event) =>
              updateCurrent({ style: event.target.value as ParticipantAvoParams['style'] })
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
            // display: 'grid',
            // gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 8,
          }}
        >
          {AVO_PALETTE.map((hue) => {
            const active = selectedAvo.hue === hue;
            return (
              <button
                key={hue}
                type="button"
                onClick={() => updateCurrent({ hue })}
                style={{
                  height: 42,
                  width: 42,
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
            value={selectedAvo.energy}
            onChange={(value) => updateCurrent({ energy: Number(value) })}
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
        <Flex justify="space-between" style={{ width: '100%' }}>
          <Button
            style={{ ...basicButtonStyle }}
            onClick={() => updateCurrent(randomizeAvo(selectedAvo.name || name || 'guest'))}
          >
            {t('avo.shuffle')}
          </Button>
          <Button
            style={{ ...basicButtonStyle }}
            onClick={() => {
              const idx = selectedIndex;
              setDraftList((prev) => {
                const next = [...prev];
                next[idx] = normalizeAvoParams(undefined, next[idx].name || name || 'guest');
                return next;
              });
            }}
          >
            {t('avo.reset')}
          </Button>
        </Flex>
        <div style={{ flex: 1 }} />

        <Button block type="primary" loading={saving} onClick={() => onSave(draftList)}>
          {t('dashboard.save')}
        </Button>
        <Flex justify="space-between" style={{ width: '100%' }}>
          <Button
            style={{ ...basicButtonStyle }}
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            {t('avo.export') || 'Export'}
          </Button>
          <div style={{ width: 'calc(50% - 8px)' }}>
            <Upload
              style={{ display: 'inline-block', width: '100%' }}
              accept=".json"
              showUploadList={false}
              beforeUpload={handleImport}
            >
              <Button style={{ ...basicButtonStyle, width: '100%' }} icon={<UploadOutlined />}>
                {t('avo.import') || 'Import'}
              </Button>
            </Upload>
          </div>
        </Flex>
      </div>

      {/* AVO 列表 */}
      {draftList.length > 0 && (
        <div>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
            <Text strong>{t('avo.presets') || 'Presets'}</Text>
            <Button style={{ marginTop: 8 }} onClick={addItem}>
              + {t('avo.addPreset') || 'Add'}
            </Button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draftList.map((item, idx) => (
              <div
                key={`${idx}-${item.variant}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: idx === selectedIndex ? '#131518' : 'transparent',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* 左侧静态形象 */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: '#0F1214',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <ParticipantAvoPlaceholder
                    key={`list-${idx}-${item.variant}`}
                    name={item.name}
                    avo={item}
                    interactive={false}
                    fallbackToPlaceholder={false}
                  />
                </div>
                {/* 中间名称 */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: 48,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#ffffff',
                      fontSize: 16,
                    }}
                  >
                    {item.name || 'guest'}
                  </div>
                  <div style={{ opacity: 0.6, fontSize: 12 }}>{item.style}</div>
                </div>
                {/* 右侧操作 */}
                <Space size={4}>
                  <Button
                    size="small"
                    type={idx === selectedIndex ? 'primary' : 'default'}
                    onClick={() => loadItem(idx)}
                  >
                    {t('avo.load') || 'Load'}
                  </Button>
                  <Button
                    size="small"
                    style={{
                      backgroundColor: 'transparent',
                      color: '#da3535ff',
                      border: '1px solid #da3535ff',
                    }}
                    // disabled={draftList.length <= 1}
                    onClick={() => deleteItem(idx)}
                  >
                    {t('avo.delete') || 'Delete'}
                  </Button>
                </Space>
              </div>
            ))}
          </div>
        </div>
      )}
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
  avoList?: ParticipantAvoParams[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (params: ParticipantAvoParams[]) => void | Promise<void>;
}

export function ParticipantAvoEditorModal({
  open,
  name,
  avoList,
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
        avoList={avoList}
        saving={saving}
        onSave={onSave}
      />
    </Modal>
  );
}
