import { AICutAnalysisRes, AICutAnalysisResLine } from '@/lib/ai/analysis';
import { Button, Empty, Tag, Tooltip } from 'antd';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '@/styles/apps.module.scss';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/i18n';
import { SpaceInfo } from '@/lib/std/space';
import { useLocalParticipant } from '@livekit/components-react';
import { CopyButton } from '../controls/widgets/copy';
import { MessageInstance } from 'antd/es/message/interface';
import { isMobile } from '@/lib/std';

export interface AICutAnalysisMdTabsProps {
  result?: AICutAnalysisRes;
  reloadResult?: () => Promise<void>;
  style: React.CSSProperties;
  showSettings?: (open: boolean) => void;
  setFlotAppOpen?: (open: boolean) => void;
  startOrStopAICutAnalysis?: (
    open: boolean,
    freq: number,
    spent: boolean,
    todo: boolean,
    reload?: boolean,
  ) => Promise<void>;
  openAIServiceAskNote?: () => void;
  spaceInfo: SpaceInfo;
  userId?: string;
  messageApi: MessageInstance;
  isSelf: boolean;
}

export function AICutAnalysisMdTabs({
  style,
  showSettings,
  result,
  reloadResult,
  setFlotAppOpen,
  startOrStopAICutAnalysis,
  spaceInfo,
  userId,
  openAIServiceAskNote,
  messageApi,
  isSelf,
}: AICutAnalysisMdTabsProps) {
  const { t } = useI18n();
  const { localParticipant } = useLocalParticipant();
  // 真正的 md 内容
  const md = useMemo(() => {
    if (!result) return '';

    if (result.markdown) {
      return result.markdown;
    }

    // 处理嵌套的 lines 数组结构
    const flattenedLines = result.lines.flat();
    console.warn(result);
    const markdown = flattenedLines
      .map((line: AICutAnalysisResLine) => {
        // 如果有 name，作为标题显示
        const title =
          (line.name ? `## ${line.name}` : '') +
          `(${new Date(line.timestamp).toLocaleString()})\n\n`;
        return title + line.content;
      })
      .join('\n\n');

    return markdown;
  }, [result]);

  const cutParams = useMemo(() => {
    let realUserId = !userId ? localParticipant.identity : userId;

    const { todo, spent, enabled } = spaceInfo.participants[realUserId]?.ai.cut;
    return {
      freq: spaceInfo.ai.cut.freq,
      spent: spent || false,
      todo: todo || false,
      isSelf,
      enabled: enabled || false,
    };
  }, [spaceInfo, userId, localParticipant, isSelf]);

  return (
    <div
      style={{
        ...style,
        marginBottom: 8,
        backgroundColor: '#1e1e1e',
        minHeight: '420px',
      }}
    >
      <div className={styles.ai_analysis_md_header}>
        <div>{t('ai.cut.report')}</div>
        {cutParams.isSelf && (
          <div className={styles.ai_analysis_md_icons}>
            <Tooltip title={t('ai.cut.reload')}>
              <ReloadOutlined
                className={styles.ai_analysis_md_header_icon}
                onClick={() => {
                  reloadResult && reloadResult();
                }}
              />
            </Tooltip>
            <Tooltip title={t('ai.cut.title')}>
              <SettingOutlined
                className={styles.ai_analysis_md_header_icon}
                onClick={() => {
                  setFlotAppOpen && setFlotAppOpen(false);
                  showSettings && showSettings(true);
                }}
              />
            </Tooltip>
            <Tooltip title={t('ai.cut.copy')}>
              <CopyButton text={md} messageApi={messageApi}></CopyButton>
            </Tooltip>
          </div>
        )}
      </div>
      {isSelf && (
        <div className={styles.ai_analysis_md_subheader}>
          <div>
            <Tag>Today</Tag>: {new Date().toLocaleDateString()}
          </div>
          <Button
            type="primary"
            icon={
              cutParams.enabled ? (
                <PauseCircleOutlined className={styles.ai_analysis_md_header_icon} />
              ) : (
                <PlayCircleOutlined className={styles.ai_analysis_md_header_icon} />
              )
            }
            onClick={() => {
              if (cutParams.enabled) {
                startOrStopAICutAnalysis &&
                  startOrStopAICutAnalysis(false, cutParams.freq, cutParams.spent, cutParams.todo);
              } else {
                if (!localParticipant.isScreenShareEnabled) {
                  openAIServiceAskNote && openAIServiceAskNote();
                  return;
                }
                if (localParticipant.isScreenShareEnabled) {
                  startOrStopAICutAnalysis &&
                    startOrStopAICutAnalysis(true, cutParams.freq, cutParams.spent, cutParams.todo);
                }
              }
            }}
          >
            {t(cutParams.enabled ? 'ai.cut.stop' : 'ai.cut.start')}
          </Button>
        </div>
      )}
      <div className={styles.ai_analysis_md_content}>
        {!md ? (
          <div className={styles.ai_analysis_md_empty}>
            <Empty description={t('ai.cut.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <ReactMarkdown>{md}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}
