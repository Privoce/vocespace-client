import { AICutAnalysisRes, AICutAnalysisResLine } from '@/lib/ai/analysis';
import { Card, Tabs, TabsProps } from 'antd';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

export interface AICutAnalysisMdProps {
  md: string;
}

export function AICutAnalysisMd({ md }: AICutAnalysisMdProps) {
  return (
    <Card style={{ height: '100%' }}>
      <ReactMarkdown>{md}</ReactMarkdown>
    </Card>
  );
}

export interface AICutAnalysisTabItem {
  userId: string;
  username: string;
  lines: AICutAnalysisRes;
}

export interface AICutAnalysisMdTabsProps {
  items: AICutAnalysisTabItem[];
}

export function AICutAnalysisMdTabs({ items }: AICutAnalysisMdTabsProps) {
  const tabItems = useMemo(() => {
    return items.map((item) => {
      const md =
        item.lines.markdown ||
        item.lines.lines
          .map((line) => {
            return line.content;
          })
          .join('\n');

      return {
        key: item.userId,
        label: item.username,
        children: <AICutAnalysisMd md={md} />,
      };
    });
  }, [items]);

  return (
    // <div style={{ flex: 1, backgroundColor: '#fff', maxHeight: '86vh', height: "fit-content" }}>
    //   <Tabs items={tabItems} size="small"></Tabs>
    // </div>
    tabItems[0].children
  );
}
