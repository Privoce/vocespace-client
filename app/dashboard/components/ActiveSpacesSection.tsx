import React from 'react';
import { Card, Table, Tabs, Space, Badge, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';

interface ParticipantTableData {
  key: string;
  spaceId: string;
  participantId: string;
  name: string;
  volume: number;
  blur: number;
  screenBlur: number;
  status: boolean;
  isOwner: boolean;
  isRecording: boolean;
  virtualEnabled: boolean;
  during: string;
  online: boolean;
  isAuth: boolean;
}

interface ActiveSpacesSectionProps {
  groupedSpacesData: { [spaceId: string]: ParticipantTableData[] };
  loading: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

export const ActiveSpacesSection: React.FC<ActiveSpacesSectionProps> = ({
  groupedSpacesData,
  loading,
  pageSize,
  onPageSizeChange,
}) => {
  const { t } = useI18n();

  const columns: ColumnsType<ParticipantTableData> = [
    {
      title: t('dashboard.active.table.participant'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string, record) => (
        <Space align="center">
          <span>{name}</span>
          {record.isOwner && t('dashboard.host_label')}
          {record.isRecording && (
            <SvgResource type="record" svgSize={16} color="#ffffff"></SvgResource>
          )}
        </Space>
      ),
    },
    {
      title: t('dashboard.active.table.state'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: boolean) => <span>{status ? t('dashboard.status.online') : t('dashboard.status.offline')}</span>,
    },
    {
      title: (
        <div>
          <SvgResource type="volume" svgSize={16} color="#ffffff"></SvgResource>
          {t('dashboard.active.table.volume')}
        </div>
      ),
      dataIndex: 'volume',
      key: 'volume',
      width: 80,
      render: (volume: number) => <span>{volume}%</span>,
    },
    {
      title: (
        <div>
          <SvgResource type="blur" svgSize={16} color="#ffffff"></SvgResource>
          {t('dashboard.active.table.blur')}
        </div>
      ),
      dataIndex: 'blur',
      key: 'blur',
      width: 100,
      render: (blur: number) => <span>{blur * 100}%</span>,
    },
    {
      title: (
        <div>
          <SvgResource type="blur" svgSize={16} color="#ffffff"></SvgResource>
          {t('dashboard.active.table.screen_blur')}
        </div>
      ),
      dataIndex: 'screenBlur',
      key: 'screenBlur',
      width: 100,
      render: (screenBlur: number) => <span>{screenBlur * 100}%</span>,
    },
    {
      title: t('dashboard.active.table.is_auth'),
      dataIndex: 'isAuth',
      key: 'isAuth',
      width: 100,
      render: (enabled: boolean) => <span>{enabled ? 'true' : 'false'}</span>,
    },
    {
      title: t('dashboard.active.table.during'),
      dataIndex: 'during',
      key: 'during',
      width: 100,
      ellipsis: true,
    },
  ];

  return (
    <Card style={{ marginBottom: 24 }}>
      {Object.keys(groupedSpacesData).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          {t('dashboard.active.empty_room')}
        </div>
      ) : (
        <>
          <Typography.Title level={5}>{t('dashboard.active.title')}</Typography.Title>
          <Tabs
            items={Object.entries(groupedSpacesData).map(([spaceId, participants]) => ({
              key: spaceId,
              label: (
                <Space>
                  <span>{spaceId}</span>
                  <Badge count={participants.length} size="small" />
                  {participants.some((p) => p.isRecording) && (
                    <SvgResource type="record" svgSize={14} color="#ff4d4f" />
                  )}
                </Space>
              ),
              children: (
                <Table
                  columns={columns}
                  dataSource={participants}
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
              ),
            }))}
          />
        </>
      )}
    </Card>
  );
};
