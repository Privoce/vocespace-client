import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';

interface DashboardStatsProps {
  totalSpaces: number;
  totalParticipants: number;
  onlineParticipants: number;
  authParticipants: number;
  action: React.ReactNode;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  totalSpaces,
  totalParticipants,
  onlineParticipants,
  authParticipants,
  action,
}) => {
  const { t } = useI18n();

  return (
    <Row gutter={16}>
      <Col span={4}>
        <Card>
          <Statistic title={t('dashboard.count.room')} value={totalSpaces} />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title={t('dashboard.count.participant')}
            value={totalParticipants}
            prefix={<SvgResource type="user" svgSize={16} color="#ffffff"></SvgResource>}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title={t('dashboard.count.online_participant')}
            value={onlineParticipants}
            prefix={<SvgResource type="user" svgSize={16} color="#ffffff"></SvgResource>}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title={t('dashboard.count.platform')}
            value={authParticipants}
            prefix={<SvgResource type="user" svgSize={16} color="#ffffff"></SvgResource>}
          />
        </Card>
      </Col>
      <Col span={8}>{action}</Col>
    </Row>
  );
};
