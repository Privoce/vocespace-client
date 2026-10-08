import React from 'react';
import { Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useI18n } from '@/lib/i18n/i18n';

interface HistorySpaceData {
  key: string;
  room: string;
  during: string;
  today: string;
}

interface HistorySpacesSectionProps {
  historySpacesData: HistorySpaceData[];
  loading: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

export const HistorySpacesSection: React.FC<HistorySpacesSectionProps> = ({
  historySpacesData,
  loading,
  pageSize,
  onPageSizeChange,
}) => {
  const { t } = useI18n();

  const parseTime = (time: string) => {
    const hours = time.includes('h') ? parseInt(time.split('h')[0]) : 0;
    const minutes = time.includes('m')
      ? parseInt(time.split('m')[0].split(' ').pop() || '0')
      : 0;
    return hours * 60 + minutes;
  };

  const columns: ColumnsType<HistorySpaceData> = [
    {
      title: t('dashboard.count.history.table.room'),
      dataIndex: 'room',
      key: 'room',
      width: 200,
    },
    {
      title: t('dashboard.count.history.table.total'),
      dataIndex: 'during',
      key: 'during',
      width: 150,
      sorter: (a, b) => parseTime(a.during) - parseTime(b.during),
    },
    {
      title: t('dashboard.count.history.table.today'),
      dataIndex: 'today',
      key: 'today',
      width: 150,
      sorter: (a, b) => parseTime(a.today) - parseTime(b.today),
    },
  ];

  return (
    <Card style={{ marginBottom: 24 }}>
      <Table
        columns={columns}
        dataSource={historySpacesData}
        loading={loading}
        pagination={{
          pageSize: pageSize,
          showSizeChanger: true,
          showQuickJumper: true,
          onShowSizeChange(current, size) {
            onPageSizeChange(size);
          },
          showTotal: (total, range) =>
            `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
              'recording.pagation.total',
            )} ${total}`,
        }}
        rowKey="key"
      />
    </Card>
  );
};
