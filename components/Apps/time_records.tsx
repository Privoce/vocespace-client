import { List } from 'antd';
import styles from '@/styles/apps.module.scss';
import { CardSize } from 'antd/es/card/Card';
import { useMemo } from 'react';

export interface TimeRecordsProps {
  data: string[];
  clear: () => void;
  size?: CardSize;
}

export function TimeRecords({ data, clear, size }: TimeRecordsProps) {
  const recordStyle = useMemo(() => {
    if (size === 'default') {
      return {};
    } else {
      return { fontSize: '12px' };
    }
  }, [size]);

  return (
    <List
      split={false}
      locale={{
        emptyText: <></>,
      }}
      dataSource={data}
      renderItem={(item) => (
        <List.Item>
          <strong className={styles.record_item} style={recordStyle}>
            {item}
          </strong>
        </List.Item>
      )}
    ></List>
  );
}
