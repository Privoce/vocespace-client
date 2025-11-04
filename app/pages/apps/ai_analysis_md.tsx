import { AICutAnalysisRes, AICutAnalysisResLine } from '@/lib/ai/analysis';
import { Tooltip } from 'antd';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '@/styles/apps.module.scss';
import { ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/i18n';

export interface AICutAnalysisMdTabsProps {
  result?: AICutAnalysisRes;
  reloadResult?: () => Promise<void>;
  height: number;
  showSettings?: (open: boolean) => void;
}

export function AICutAnalysisMdTabs({
  height,
  showSettings,
  result,
  reloadResult,
}: AICutAnalysisMdTabsProps) {
  const { t } = useI18n();

  // 真正的 md 内容
  const md = useMemo(() => {
    if (!result) return '';

    if (result.markdown) {
      return result.markdown;
    }

    // 处理嵌套的 lines 数组结构
    const flattenedLines = result.lines.flat();

    const markdown = flattenedLines
      .map((line: AICutAnalysisResLine) => {
        // 如果有 name，作为标题显示
        const title = line.name
          ? `## ${line.name}\n\n`
          : '' + `(${new Date(line.timestamp).toLocaleString()})`;
        return title + line.content;
      })
      .join('\n\n');

    console.warn('Generated markdown from lines:', markdown);
    return markdown;
  }, [result]);

  // const downloadMd = () => {
  //   const modal = Modal.confirm({});

  //   modal.update({
  //     title: t('ai.cut.download'),
  //     content: t('ai.cut.download_content'),
  //     okText: t('common.confirm'),
  //     cancelText: t('common.cancel'),
  //     onOk: async () => {
  //       const response = await api.ai.downloadMarkdown(space, item.userId);
  //       if (response.ok) {
  //         const { md }: { md: string } = await response.json();
  //         downloadMarkdown(md);
  //       } else {
  //         messageApi.error(t('ai.cut.error.download'));
  //       }
  //     },
  //   });

  //   modal.destroy();
  // };

  return (
    <div style={{ height: height, width: '720px', marginBottom: 8, backgroundColor: '#1e1e1e' }}>
      <div className={styles.ai_analysis_md_header}>
        <Tooltip title={t('ai.cut.reload')}>
          <ReloadOutlined className={styles.ai_analysis_md_header_icon} onClick={reloadResult} />
        </Tooltip>
        {/* <Tooltip title={t('ai.cut.download')}>
          <DownloadOutlined className={styles.ai_analysis_md_header_icon} onClick={downloadMd} />
        </Tooltip> */}
        <Tooltip title={t('ai.cut.reload')}>
          <SettingOutlined
            className={styles.ai_analysis_md_header_icon}
            onClick={() => showSettings && showSettings(true)}
          />
        </Tooltip>
      </div>
      <div className={styles.ai_analysis_md_content}>
        <ReactMarkdown>{md}</ReactMarkdown>
      </div>
    </div>
  );
}
