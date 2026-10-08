import { Listy } from 'antd';
import styles from '@/styles/apps.module.scss';
import { CardSize } from 'antd/es/card/Card';
import { useMemo } from 'react';

export interface TimeRecordsProps {
  data: string[];
  clear: () => void;
  size?: CardSize;
}

export function TimeRecords({ data, size }: TimeRecordsProps) {
  const recordStyle = useMemo(() => {
    if (size === 'default') {
      return {};
    } else {
      return { fontSize: '12px' };
    }
  }, [size]);

  if (data.length === 0) {
    return null;
  }

  return (
    <Listy
      items={data}
      rowKey={(item) => item}
      itemRender={(item) => (
        <strong className={styles.record_item} style={recordStyle}>
          {item}
        </strong>
      )}
      styles={{ item: { padding: '12px 0' } }}
    ></Listy>
  );
}
