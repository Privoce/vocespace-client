import { AICutAnalysisRes, AICutAnalysisResLine, downloadMarkdown } from '@/lib/ai/analysis';
import { Card, Modal, Tooltip } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '@/styles/apps.module.scss';
import { DownloadOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/i18n';
import { api } from '@/lib/api';
import { MessageInstance } from 'antd/es/message/interface';

export interface AICutAnalysisMdProps {
  md: string;
}

export function AICutAnalysisMd({ md }: AICutAnalysisMdProps) {}

export interface AICutAnalysisTabItem {
  userId: string;
  username: string;
  lines: AICutAnalysisRes;
}

export interface AICutAnalysisMdTabsProps {
  item: AICutAnalysisTabItem;
  space: string;
  messageApi: MessageInstance;
  height: number;
}

export function AICutAnalysisMdTabs({ item, space, messageApi, height }: AICutAnalysisMdTabsProps) {
  const { t } = useI18n();
  // const tabItems = useMemo(() => {
  //   return items.map((item) => {
  //     const md =
  //       item.lines.markdown ||
  //       item.lines.lines
  //         .map((line) => {
  //           return line.content;
  //         })
  //         .join('\n');

  //     return {
  //       key: item.userId,
  //       label: item.username,
  //       children: <AICutAnalysisMd md={md} />,
  //     };
  //   });
  // }, [items]);

  // return (
  //   <div style={{ flex: 1, backgroundColor: '#fff', maxHeight: '86vh', height: "fit-content" }}>
  //     <Tabs items={tabItems} size="small"></Tabs>
  //   </div>
  // );

  const [result, setResult] = useState(item.lines);
  // 更新 md 内容如果外部 item 变化
  useEffect(() => {
    setResult(item.lines);
  }, [item]);
  // 真正的 md 内容
  const md = useMemo(() => {
    return (
      result.markdown ||
      result.lines
        .map((line: AICutAnalysisResLine) => {
          return line.content;
        })
        .join('\n')
    );
  }, [result]);

  const downloadMd = () => {
    const modal = Modal.confirm({});

    modal.update({
      title: t('ai.cut.download'),
      content: t('ai.cut.download_content'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        const response = await api.ai.downloadMarkdown(space, item.userId);
        if (response.ok) {
          const { md }: { md: string } = await response.json();
          downloadMarkdown(md);
        } else {
          messageApi.error(t('ai.cut.error.download'));
        }
      },
    });

    modal.destroy();
  };

  const reloadResult = async () => {
    const response = await api.ai.getAnalysisRes(space, item.userId);
    if (response.ok) {
      const { res }: { res: AICutAnalysisRes } = await response.json();
      setResult(res);
      messageApi.success(t('ai.cut.success.reload'));
    } else {
      messageApi.error(t('ai.cut.error.reload'));
    }
  };

  return (
    <div style={{ height: height, width: '720px', marginBottom: 8, backgroundColor:"#1e1e1e"}} >
      <div className={styles.ai_analysis_md_header}>
        <Tooltip title={t('ai.cut.reload')}>
          <ReloadOutlined className={styles.ai_analysis_md_header_icon} onClick={reloadResult} />
        </Tooltip>
        {/* <Tooltip title={t('ai.cut.download')}>
          <DownloadOutlined className={styles.ai_analysis_md_header_icon} onClick={downloadMd} />
        </Tooltip> */}
        <Tooltip title={t('ai.cut.reload')}>
          <SettingOutlined className={styles.ai_analysis_md_header_icon} onClick={reloadResult} />
        </Tooltip>
      </div>
      <div className={styles.ai_analysis_md_content}>
        <ReactMarkdown>{md}</ReactMarkdown>
      </div>
    </div>
  );
}
