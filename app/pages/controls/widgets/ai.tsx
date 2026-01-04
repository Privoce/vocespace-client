import { AICutDeps, Extraction } from '@/lib/ai/analysis';
import { useI18n } from '@/lib/i18n/i18n';
import { SpaceInfo } from '@/lib/std/space';
import styles from '@/styles/controls.module.scss';
import { InfoCircleFilled } from '@ant-design/icons';
import { Checkbox, CheckboxOptionType, GetProp, Radio, Slider, Tooltip } from 'antd';
import { Room } from 'livekit-client';
import { useEffect, useMemo, useState } from 'react';

export interface UseAICutAnalysisSettings {
  space?: Room;
  spaceInfo: SpaceInfo;
}

export interface UseAICutAnalysisSettingsExports {
  aiCutDeps: AICutDeps[];
  setAICutDeps: (deps: AICutDeps[]) => void;
  extraction: Extraction;
  setExtraction: (extraction: Extraction) => void;
  cutFreq: number;
  setCutFreq: (freq: number) => void;
  cutBlur: boolean;
  setCutBlur: (blur: boolean) => void;
  isServiceOpen: boolean;
  setIsServiceOpen: (open: boolean) => void;
  aiCutOptions: CheckboxOptionType<AICutDeps>[];
  aiCutOptionsChange: GetProp<typeof Checkbox.Group, 'onChange'>;
}

export const useAICutAnalysisSettings = ({
  space,
  spaceInfo,
}: UseAICutAnalysisSettings): UseAICutAnalysisSettingsExports => {
  const { t } = useI18n();
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [aiCutDeps, setAICutDeps] = useState<AICutDeps[]>(['screen', 'todo']);
  const [extraction, setExtraction] = useState<Extraction>('medium');
  const [cutFreq, setCutFreq] = useState(3);
  const [cutBlur, setCutBlur] = useState(false);

  const aiCutOptions: CheckboxOptionType<AICutDeps>[] = useMemo(() => {
    return [
      { label: t('ai.cut.share_screen'), value: 'screen' },
      { label: t('ai.cut.share_todo'), value: 'todo' },
      { label: t('ai.cut.share_time'), value: 'spent' },
    ];
  }, [t]);

  const aiCutOptionsChange: GetProp<typeof Checkbox.Group, 'onChange'> = async (checkedValues) => {
    setAICutDeps(checkedValues as AICutDeps[]);
  };

  useEffect(() => {
    if (
      space &&
      space.localParticipant &&
      spaceInfo.participants[space.localParticipant.identity]
    ) {
      const { spent, todo, extraction, blur } =
        spaceInfo.participants[space.localParticipant.identity]?.ai.cut;
      const deps: AICutDeps[] = ['screen'];
      if (spent) {
        deps.push('spent');
      }
      if (todo) {
        deps.push('todo');
      }
      setAICutDeps(deps);
      setExtraction(extraction);
      setIsServiceOpen(
        // spaceInfo.participants[space.localParticipant.identity]?.ai.cut.enabled || false,
        spaceInfo.ai.cut.enabled || false,
      );
      setCutBlur(blur);
      setCutFreq(spaceInfo.ai.cut.freq || 3);
    }
  }, [space, spaceInfo]);

  return {
    aiCutDeps,
    setAICutDeps,
    extraction,
    setExtraction,
    cutFreq,
    setCutFreq,
    cutBlur,
    setCutBlur,
    isServiceOpen,
    setIsServiceOpen,
    aiCutOptions,
    aiCutOptionsChange,
  };
};

export interface AICutAnalysisSettingsPanelProps extends UseAICutAnalysisSettingsExports {
  space?: Room;
  spaceInfo: SpaceInfo;
  isPanel?: boolean;
}

export function AICutAnalysisSettingsPanel({
  space,
  spaceInfo,
  isServiceOpen,
  setIsServiceOpen,
  aiCutDeps,
  setAICutDeps,
  extraction,
  setExtraction,
  cutFreq,
  setCutFreq,
  cutBlur,
  setCutBlur,
  aiCutOptions,
  aiCutOptionsChange,
  isPanel = true,
}: AICutAnalysisSettingsPanelProps) {
  const { t } = useI18n();

  const showSettings = useMemo(() => {
    return isPanel ? isServiceOpen : true;
  }, [isPanel, isServiceOpen]);

  return (
    <div>
      <div>{t('more.ai.desc')}</div>
      {!isPanel && (
        <div className={styles.ai_cut_line}>
          <div className={styles.ai_cut_line}>
            <span> {t('ai.cut.open')}</span>
          </div>
          <div style={{ width: '100%' }}>
            {space && (
              <Radio.Group
                size="large"
                block
                value={isServiceOpen}
                onChange={(e) => setIsServiceOpen(e.target.value)}
              >
                <Radio.Button value={true}>{t('common.open')}</Radio.Button>
                <Radio.Button value={false}>{t('common.close')}</Radio.Button>
              </Radio.Group>
            )}
          </div>
        </div>
      )}


      {space?.localParticipant.identity === spaceInfo.ownerId && showSettings && (
        <>
          {' '}
          <div className={styles.ai_cut_line}>
            <span> {t('ai.cut.freq')}</span>
            <Tooltip title={t('ai.cut.freq_desc')} trigger={['hover']}>
              <InfoCircleFilled></InfoCircleFilled>
            </Tooltip>
          </div>{' '}
          <Slider min={1} max={15} value={cutFreq} onChange={(v) => setCutFreq(v)} step={0.5} />
        </>
      )}
      {showSettings && (
        <div className={styles.ai_cut_line}>
          <div className={styles.ai_cut_line}>
            <span> {t('ai.cut.source_dep')}</span>
            <Tooltip title={t('ai.cut.source_dep_desc')} trigger={['hover']}>
              <InfoCircleFilled></InfoCircleFilled>
            </Tooltip>
          </div>
          <div style={{ width: '100%' }}>
            <Checkbox.Group
              value={aiCutDeps}
              options={aiCutOptions}
              onChange={aiCutOptionsChange}
            />
          </div>
          <div className={styles.ai_cut_line}>
            <span> {t('ai.cut.extraction.title')}</span>
            <Tooltip title={t('ai.cut.extraction.desc')} trigger={['hover']}>
              <InfoCircleFilled></InfoCircleFilled>
            </Tooltip>
          </div>
          <div style={{ width: '100%' }}>
            <Radio.Group
              size="large"
              block
              value={extraction}
              onChange={(e) => setExtraction(e.target.value)}
            >
              <Radio.Button value="easy">{t('ai.cut.extraction.easy')}</Radio.Button>
              <Radio.Button value="medium">{t('ai.cut.extraction.medium')}</Radio.Button>
              <Radio.Button value="max">{t('ai.cut.extraction.max')}</Radio.Button>
            </Radio.Group>
          </div>
          <div className={styles.ai_cut_line}>
            <span> {t('ai.cut.blur.title')}</span>
            <Tooltip title={t('ai.cut.blur.desc')} trigger={['hover']}>
              <InfoCircleFilled></InfoCircleFilled>
            </Tooltip>
          </div>
          <div style={{ width: '100%' }}>
            <Radio.Group
              size="large"
              block
              value={cutBlur}
              onChange={(e) => setCutBlur(e.target.value)}
            >
              <Radio.Button value={true}>{t('common.open')}</Radio.Button>
              <Radio.Button value={false}>{t('common.close')}</Radio.Button>
            </Radio.Group>
          </div>
        </div>
      )}
    </div>
  );
}
