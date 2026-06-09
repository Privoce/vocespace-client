import React from 'react';
import { Card, Table, Tabs, Space, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useI18n } from '@/lib/i18n/i18n';

interface LeaderboardData {
  key: string;
  participantName: string;
  spaceId: string;
  totalDuration: number;
  periodDuration: number;
  totalDisplay: string;
  periodDisplay: string;
}

interface LeaderboardSectionProps {
  dailyLeaderboard: { [spaceId: string]: LeaderboardData[] };
  weeklyLeaderboard: { [spaceId: string]: LeaderboardData[] };
  monthlyLeaderboard: { [spaceId: string]: LeaderboardData[] };
  loading: boolean;
}

export const LeaderboardSection: React.FC<LeaderboardSectionProps> = ({
  dailyLeaderboard,
  weeklyLeaderboard,
  monthlyLeaderboard,
  loading,
}) => {
  const { t } = useI18n();

  const createLeaderboardColumns = (periodTitle: string): ColumnsType<LeaderboardData> => [
    {
      title: t('dashboard.active.table.participant'),
      dataIndex: 'participantName',
      key: 'participantName',
      width: 150,
    },
    {
      title: `${periodTitle}${t('dashboard.common.during')}`,
      dataIndex: 'periodDisplay',
      key: 'periodDisplay',
      width: 120,
      sorter: (a, b) => a.periodDuration - b.periodDuration,
      defaultSortOrder: 'descend',
    },
    {
      title: `${t('dashboard.common.total')}${t('dashboard.common.during')}`,
      dataIndex: 'totalDisplay',
      key: 'totalDisplay',
      width: 120,
      sorter: (a, b) => a.totalDuration - b.totalDuration,
    },
  ];

  const dailyColumns = createLeaderboardColumns(t('dashboard.common.day'));
  const weeklyColumns = createLeaderboardColumns(t('dashboard.common.week'));
  const monthlyColumns = createLeaderboardColumns(t('dashboard.common.month'));

  const allSpaceIds = new Set([
    ...Object.keys(dailyLeaderboard),
    ...Object.keys(weeklyLeaderboard),
    ...Object.keys(monthlyLeaderboard),
  ]);

  if (allSpaceIds.size === 0) {
    return null;
  }

  return (
    <Card style={{ marginBottom: 24 }}>
      <Tabs
        items={Array.from(allSpaceIds).map((spaceId) => ({
          key: spaceId,
          label: (
            <Space>
              <span>{spaceId}</span>
              <Badge
                count={
                  (dailyLeaderboard[spaceId]?.length || 0) +
                  (weeklyLeaderboard[spaceId]?.length || 0) +
                  (monthlyLeaderboard[spaceId]?.length || 0)
                }
                size="small"
              />
            </Space>
          ),
          children: (
            <Tabs
              items={[
                {
                  key: 'daily',
                  label: t('dashboard.common.day'),
                  children: (
                    <Table
                      columns={dailyColumns}
                      dataSource={dailyLeaderboard[spaceId] || []}
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                      rowKey="key"
                    />
                  ),
                },
                {
                  key: 'weekly',
                  label: t('dashboard.common.week'),
                  children: (
                    <Table
                      columns={weeklyColumns}
                      dataSource={weeklyLeaderboard[spaceId] || []}
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                      rowKey="key"
                    />
                  ),
                },
                {
                  key: 'monthly',
                  label: t('dashboard.common.month'),
                  children: (
                    <Table
                      columns={monthlyColumns}
                      dataSource={monthlyLeaderboard[spaceId] || []}
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                      rowKey="key"
                    />
                  ),
                },
              ]}
            />
          ),
        }))}
      />
    </Card>
  );
};
