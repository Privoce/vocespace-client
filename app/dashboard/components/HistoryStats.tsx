import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { useI18n } from '@/lib/i18n/i18n';

interface HistoryStatsProps {
  /** 历史房间总数 */
  totalRooms: number;
  /** 历史所有用户数（去重） */
  totalUsers: number;
  /** 平台用户数（已认证用户，去重） */
  platformUsers: number;
  /** 平均使用总时长（格式化后的字符串，如 "2h 30m"） */
  avgDuration: string;
}

export const HistoryStats: React.FC<HistoryStatsProps> = ({
  totalRooms,
  totalUsers,
  platformUsers,
  avgDuration,
}) => {
  const { t } = useI18n();

  return (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card style={{ height: '100%' }}>
          <Statistic title={t('dashboard.count.history.stats.rooms')} value={totalRooms} />
        </Card>
      </Col>
      <Col span={6}>
        <Card style={{ height: '100%' }}>
          <Statistic title={t('dashboard.count.history.stats.total_users')} value={totalUsers} />
        </Card>
      </Col>
      <Col span={6}>
        <Card style={{ height: '100%' }}>
          <Statistic
            title={t('dashboard.count.history.stats.platform_users')}
            value={platformUsers}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card style={{ height: '100%' }}>
          <Statistic title={t('dashboard.count.history.stats.avg_duration')} value={avgDuration} />
        </Card>
      </Col>
    </Row>
  );
};
