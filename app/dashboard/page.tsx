'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Card,
  Badge,
  Tag,
  Button,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  message,
  Modal,
  Input,
  Tabs,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SvgResource } from '../resources/svg';
import styles from '@/styles/dashboard.module.scss';
import { api } from '@/lib/api';
import { ConfQulity, useRTCConf, useVoceSpaceConf } from '../pages/controls/settings/conf';
import { ParticipantSettings, SpaceDateRecords, SpaceInfo, SpaceInfoMap } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';
import { LangSelect } from '../pages/controls/selects/lang_select';
import { usePlatformUserInfoCheap } from '@/lib/hooks/platform';

const { Title } = Typography;

const countDuring = (startAt: number): string => {
  if (!startAt) return '0m';
  const now = Date.now();
  const duration = Math.floor((now - startAt) / 1000); // 秒
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

interface LeaderboardData {
  key: string;
  participantName: string;
  spaceId: string;
  totalDuration: number; // 总时长（毫秒）
  periodDuration: number; // 期间时长（毫秒）
  totalDisplay: string; // 总时长显示
  periodDisplay: string; // 期间时长显示
}

interface HistorySpaceData {
  key: string;
  room: string;
  during: string; // 总使用时长
  today: string; // 今日使用时长
}

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

export default function Dashboard() {
  const { t } = useI18n();
  const [currentSpacesData, setCurrentSpacesData] = useState<ParticipantTableData[]>([]);
  const [historySpacesData, setHistorySpacesData] = useState<HistorySpaceData[]>([]);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<{
    [spaceId: string]: LeaderboardData[];
  }>({});
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<{
    [spaceId: string]: LeaderboardData[];
  }>({});
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<{
    [spaceId: string]: LeaderboardData[];
  }>({});
  const [loading, setLoading] = useState(false);
  const [totalSpaces, setTotalSpaces] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [onlineParticipants, setOnlineParticipants] = useState(0);
  const [authParticipants, setAuthParticipants] = useState(0);
  const [activeRecordings, setActiveRecordings] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [openConf, setOpenConf] = useState(false);
  const [isHostManager, setIsHostManager] = useState(false);
  const [hostToken, setHostToken] = useState('');
  const { conf, getConf, checkHostToken } = useVoceSpaceConf();

  // 根据 Space 分组数据
  const groupedSpacesData = useMemo(() => {
    const grouped: { [spaceId: string]: ParticipantTableData[] } = {};
    currentSpacesData.forEach((participant) => {
      if (!grouped[participant.spaceId]) {
        grouped[participant.spaceId] = [];
      }
      if (participant.online) {
        grouped[participant.spaceId].push(participant);
      }
    });
    return grouped;
  }, [currentSpacesData]);

  // 统一获取所有数据（当前空间和历史数据）
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 同时获取当前空间信息和历史记录
      const [spaceResponse, historyResponse] = await Promise.all([
        api.allSpaceInfos(),
        api.historySpaceInfos(),
      ]);

      // 处理历史数据
      let records: SpaceDateRecords | null = null;
      if (historyResponse.ok) {
        const result = await historyResponse.json();
        records = result.records;
      } else {
        messageApi.error('获取历史房间数据失败');
      }

      // 构建历史时长映射 { spaceId: { participantName: totalDuration } }
      const historicalDurations: { [spaceId: string]: { [name: string]: number } } = {};

      if (records) {
        Object.entries(records).forEach(([spaceId, timeRecords]) => {
          historicalDurations[spaceId] = {};
          Object.entries(timeRecords.participants).forEach(
            ([participantName, participantRecords]) => {
              let totalDuration = 0;
              participantRecords.forEach((record) => {
                const end = record.end || Date.now();
                totalDuration += end - record.start;
              });
              historicalDurations[spaceId][participantName] = totalDuration;
            },
          );
        });

        // 处理历史数据和榜单
        processHistoryData(records);
      }

      // 处理当前空间数据
      if (spaceResponse.ok) {
        const spaceInfoMap: SpaceInfoMap = await spaceResponse.json();

        const participantsData: ParticipantTableData[] = [];
        let roomCount = 0;
        let participantCount = 0;
        let recordingCount = 0;
        let onlineCount = 0;
        let unAuthCount = 0;
        Object.entries(spaceInfoMap).forEach(([spaceId, spaceInfo]: [string, SpaceInfo]) => {
          if (spaceInfo.participants && Object.keys(spaceInfo.participants).length > 0) {
            roomCount++;
            if (spaceInfo.record?.active) {
              recordingCount++;
            }

            Object.entries(spaceInfo.participants).forEach(
              ([participantId, participant]: [string, ParticipantSettings]) => {
                participantCount++;
                if (participant.online) {
                  onlineCount++;
                }

                if (
                  !participant.auth ||
                  participant.auth?.identity === 'guest' ||
                  participant.auth?.platform === 'other'
                ) {
                  unAuthCount++;
                }

                // 从历史记录中获取该用户的总时长
                const historicalDuration = historicalDurations[spaceId]?.[participant.name] || 0;
                const hours = Math.floor(historicalDuration / 3600000);
                const minutes = Math.floor((historicalDuration % 3600000) / 60000);
                const duringDisplay = `${hours}h ${minutes}m`;

                participantsData.push({
                  key: `${spaceId}-${participantId}`,
                  spaceId,
                  participantId,
                  name: participant.name,
                  volume: participant.volume,
                  blur: participant.blur,
                  screenBlur: participant.screenBlur,
                  status: participant.online,
                  isOwner: spaceInfo.ownerId === participantId,
                  isRecording: spaceInfo.record?.active || false,
                  virtualEnabled: participant.virtual?.enabled || false,
                  during: duringDisplay,
                  online: participant.online,
                  isAuth: usePlatformUserInfoCheap({ user: participant }).isAuth,
                });
              },
            );
          }
        });

        setCurrentSpacesData(participantsData);
        setTotalSpaces(roomCount);
        setTotalParticipants(participantCount);
        setOnlineParticipants(onlineCount);
        setAuthParticipants(
          participantCount - unAuthCount >= 0 ? participantCount - unAuthCount : 0,
        );
        setActiveRecordings(recordingCount);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理历史数据和榜单
  const processHistoryData = (records: SpaceDateRecords) => {
    // 转为 HistorySpaceData 格式
    const historyData: HistorySpaceData[] = [];
    const dailyData: { [spaceId: string]: LeaderboardData[] } = {};
    const weeklyData: { [spaceId: string]: LeaderboardData[] } = {};
    const monthlyData: { [spaceId: string]: LeaderboardData[] } = {};

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - now.getDay(),
    ).getTime();
    const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000 - 1;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    // 遍历records中的记录
    for (const [spaceId, timeRecords] of Object.entries(records)) {
      // 计算房间总使用时长和今日使用时长
      let totalSpaceDuration = 0;
      let todaySpaceDuration = 0;

      timeRecords.space.forEach((record) => {
        const end = record.end || Date.now();
        totalSpaceDuration += end - record.start;

        if (record.start >= todayStart && record.start <= todayEnd) {
          if (end > todayEnd) {
            todaySpaceDuration += todayEnd - record.start;
          } else {
            todaySpaceDuration += end - record.start;
          }
        }
      });

      historyData.push({
        key: spaceId,
        room: spaceId,
        during: `${Math.floor(totalSpaceDuration / 3600000)}h ${Math.floor(
          (totalSpaceDuration % 3600000) / 60000,
        )}m`,
        today: `${Math.floor(todaySpaceDuration / 3600000)}h ${Math.floor(
          (todaySpaceDuration % 3600000) / 60000,
        )}m`,
      });

      // 计算参与者榜单数据
      const dailyParticipants: { [name: string]: { total: number; period: number } } = {};
      const weeklyParticipants: { [name: string]: { total: number; period: number } } = {};
      const monthlyParticipants: { [name: string]: { total: number; period: number } } = {};

      // 处理参与者记录
      Object.entries(timeRecords.participants).forEach(([participantName, records]) => {
        let totalDuration = 0;
        let dailyDuration = 0;
        let weeklyDuration = 0;
        let monthlyDuration = 0;

        records.forEach((record) => {
          const end = record.end || Date.now();
          const duration = end - record.start;
          totalDuration += duration;

          // 计算日榜 - 处理跨日的情况
          const recordEnd = Math.min(end, todayEnd);
          const recordStart = Math.max(record.start, todayStart);
          if (recordStart <= todayEnd && recordEnd >= todayStart) {
            dailyDuration += Math.max(0, recordEnd - recordStart);
          }

          // 计算周榜 - 处理跨周的情况
          const weekRecordEnd = Math.min(end, weekEnd);
          const weekRecordStart = Math.max(record.start, weekStart);
          if (weekRecordStart <= weekEnd && weekRecordEnd >= weekStart) {
            weeklyDuration += Math.max(0, weekRecordEnd - weekRecordStart);
          }

          // 计算月榜 - 处理跨月的情况
          const monthRecordEnd = Math.min(end, monthEnd);
          const monthRecordStart = Math.max(record.start, monthStart);
          if (monthRecordStart <= monthEnd && monthRecordEnd >= monthStart) {
            monthlyDuration += Math.max(0, monthRecordEnd - monthRecordStart);
          }
        });

        if (totalDuration > 0) {
          dailyParticipants[participantName] = { total: totalDuration, period: dailyDuration };
          weeklyParticipants[participantName] = {
            total: totalDuration,
            period: weeklyDuration,
          };
          monthlyParticipants[participantName] = {
            total: totalDuration,
            period: monthlyDuration,
          };
        }
      });

      // 转换为LeaderboardData格式
      const formatDuration = (ms: number) => {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const second = Math.floor((ms % 60000) / 1000);
        return `${hours}h ${minutes}m ${second}s`;
      };

      dailyData[spaceId] = Object.entries(dailyParticipants)
        .map(([name, data]) => ({
          key: `${spaceId}-${name}-daily`,
          participantName: name,
          spaceId,
          totalDuration: data.total,
          periodDuration: data.period,
          totalDisplay: formatDuration(data.total),
          periodDisplay: formatDuration(data.period),
        }))
        .sort((a, b) => b.periodDuration - a.periodDuration);

      weeklyData[spaceId] = Object.entries(weeklyParticipants)
        .map(([name, data]) => ({
          key: `${spaceId}-${name}-weekly`,
          participantName: name,
          spaceId,
          totalDuration: data.total,
          periodDuration: data.period,
          totalDisplay: formatDuration(data.total),
          periodDisplay: formatDuration(data.period),
        }))
        .sort((a, b) => b.periodDuration - a.periodDuration);

      monthlyData[spaceId] = Object.entries(monthlyParticipants)
        .map(([name, data]) => ({
          key: `${spaceId}-${name}-monthly`,
          participantName: name,
          spaceId,
          totalDuration: data.total,
          periodDuration: data.period,
          totalDisplay: formatDuration(data.total),
          periodDisplay: formatDuration(data.period),
        }))
        .sort((a, b) => b.periodDuration - a.periodDuration);
    }

    setHistorySpacesData(historyData);
    setDailyLeaderboard(dailyData);
    setWeeklyLeaderboard(weeklyData);
    setMonthlyLeaderboard(monthlyData);
  };
  useEffect(() => {
    getConf();
    fetchAllData();

    // 每120秒刷新一次数据
    const interval = setInterval(() => {
      fetchAllData();
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  // 当前房间参与者表格列定义（去掉房间列，因为现在按Space分组显示）
  const currentSpacesColumns: ColumnsType<ParticipantTableData> = [
    {
      title: t('dashboard.active.table.participant'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string, record) => (
        <Space align="center">
          <span>{name}</span>
          {record.isOwner && '(host)'}
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
      render: (status: boolean) => <Tag color="blue">{status ? 'Online' : 'Offline'}</Tag>,
    },
    {
      title: (
        <div className={styles.table_header}>
          <SvgResource type="volume" svgSize={16} color="#ffffff"></SvgResource>
          {t('dashboard.active.table.volume')}
        </div>
      ),
      dataIndex: 'volume',
      key: 'volume',
      width: 80,
      render: (volume: number) => (
        <Space align="center">
          <span>{volume}%</span>
        </Space>
      ),
    },
    {
      title: (
        <div className={styles.table_header}>
          <SvgResource type="blur" svgSize={16} color="#ffffff"></SvgResource>
          {t('dashboard.active.table.blur')}
        </div>
      ),
      dataIndex: 'blur',
      key: 'blur',
      width: 100,
      render: (blur: number) => (
        <Space align="center">
          <span>{blur * 100}%</span>
        </Space>
      ),
    },
    {
      title: (
        <div className={styles.table_header}>
          <SvgResource type="blur" svgSize={16} color="#ffffff"></SvgResource>
          {t('dashboard.active.table.screen_blur')}
        </div>
      ),
      dataIndex: 'screenBlur',
      key: 'screenBlur',
      width: 100,

      render: (screenBlur: number) => (
        <Space align="center">
          <span>{screenBlur * 100}%</span>
        </Space>
      ),
    },
    {
      title: t('dashboard.active.table.is_auth'),
      dataIndex: 'isAuth',
      key: 'isAuth',
      width: 100,
      render: (enabled: boolean) => (
        <Badge status={enabled ? 'success' : 'default'} text={enabled ? 'true' : 'false'} />
      ),
    },
    {
      title: t('dashboard.active.table.during'),
      dataIndex: 'during',
      key: 'during',
      width: 100,
      ellipsis: true,
    },
  ];

  // 历史房间表格列定义
  const historySpacesColumns: ColumnsType<HistorySpaceData> = [
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
      sorter: (a, b) => {
        // 简单的时长排序逻辑
        const parseTime = (time: string) => {
          const hours = time.includes('h') ? parseInt(time.split('h')[0]) : 0;
          const minutes = time.includes('m')
            ? parseInt(time.split('m')[0].split(' ').pop() || '0')
            : 0;
          return hours * 60 + minutes;
        };
        return parseTime(a.during) - parseTime(b.during);
      },
    },
    {
      title: t('dashboard.count.history.table.today'),
      dataIndex: 'today',
      key: 'today',
      width: 150,
      sorter: (a, b) => {
        const parseTime = (time: string) => {
          const hours = time.includes('h') ? parseInt(time.split('h')[0]) : 0;
          const minutes = time.includes('m')
            ? parseInt(time.split('m')[0].split(' ').pop() || '0')
            : 0;
          return hours * 60 + minutes;
        };
        return parseTime(a.today) - parseTime(b.today);
      },
    },
  ];

  // 榜单表格列定义
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

  const confirmConfHandle = async () => {
    if (!isHostManager) {
      const success = await checkHostToken(hostToken);
      if (success) {
        setIsHostManager(true);
      } else {
        messageApi.error(t('dashboard.conf.error.verify'));
      }
    } else {
      // 当修改后
      setOpenConf(false);
      setIsHostManager(false);
      setHostToken('');
    }
  };

  return (
    <div className={styles.container} style={{ position: 'relative' }}>
      {contextHolder}
      <div style={{ position: 'absolute', right: 24, top: 16 }}>
        <LangSelect></LangSelect>
      </div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>VoceSpace Dashboard</Title>
        <Row gutter={16} style={{ marginBottom: 24 }}>
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
          <Col span={8}>
            <Card>
              <div style={{ marginBottom: '9px' }}>{t('dashboard.count.opt')}</div>
              <div style={{ display: 'inline-flex', gap: '8px' }}>
                <Button
                  type="primary"
                  onClick={async () => {
                    await fetchAllData();
                  }}
                  loading={loading}
                >
                  {t('dashboard.count.refresh')}
                </Button>
                <Button
                  color="danger"
                  variant="solid"
                  onClick={() => {
                    setOpenConf(true);
                  }}
                >
                  {t('dashboard.count.global_conf')}
                </Button>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* 当前房间用户数据 - 按Space分组 */}
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
                    columns={currentSpacesColumns}
                    dataSource={participants}
                    loading={loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                          'recording.pagation.num',
                        )}, ${t('recording.pagation.total')} ${total} ${t(
                          'recording.pagation.num',
                        )}`,
                    }}
                    scroll={{ x: 1000 }}
                  />
                ),
              }))}
            />
          </>
        )}
      </Card>

      {/* 历史数据和榜单 */}
      <Card style={{ marginBottom: 24 }}>
        <Tabs
          items={[
            {
              key: 'history',
              label: t('dashboard.count.history.title'),
              children: (
                <Table
                  columns={historySpacesColumns}
                  dataSource={historySpacesData}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) =>
                      `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                        'recording.pagation.num',
                      )}, ${t('recording.pagation.total')} ${total} ${t('recording.pagation.num')}`,
                  }}
                />
              ),
            },
            {
              key: 'daily',
              label: t('dashboard.count.history.day'),
              children:
                Object.keys(dailyLeaderboard).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    {t('dashboard.count.history.empty')}
                  </div>
                ) : (
                  <Tabs
                    type="card"
                    size="small"
                    items={Object.entries(dailyLeaderboard).map(([spaceId, participants]) => ({
                      key: `daily-${spaceId}`,
                      label: (
                        <Space>
                          <span>{spaceId}</span>
                          <Badge count={participants.length} size="small" />
                        </Space>
                      ),
                      children: (
                        <Table
                          columns={dailyColumns}
                          dataSource={participants}
                          pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) =>
                              `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                                'recording.pagation.num',
                              )}, ${t('recording.pagation.total')} ${total} ${t(
                                'recording.pagation.num',
                              )}`,
                          }}
                          scroll={{ x: 600 }}
                        />
                      ),
                    }))}
                  />
                ),
            },
            {
              key: 'weekly',
              label: t('dashboard.count.history.week'),
              children:
                Object.keys(weeklyLeaderboard).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    {t('dashboard.count.history.empty')}
                  </div>
                ) : (
                  <Tabs
                    type="card"
                    size="small"
                    items={Object.entries(weeklyLeaderboard).map(([spaceId, participants]) => ({
                      key: `weekly-${spaceId}`,
                      label: (
                        <Space>
                          <span>{spaceId}</span>
                          <Badge count={participants.length} size="small" />
                        </Space>
                      ),
                      children: (
                        <Table
                          columns={weeklyColumns}
                          dataSource={participants}
                          pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) =>
                              `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                                'recording.pagation.num',
                              )}, ${t('recording.pagation.total')} ${total} ${t(
                                'recording.pagation.num',
                              )}`,
                          }}
                          scroll={{ x: 600 }}
                        />
                      ),
                    }))}
                  />
                ),
            },
            {
              key: 'monthly',
              label: t('dashboard.count.history.month'),
              children:
                Object.keys(monthlyLeaderboard).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    {t('dashboard.count.history.empty')}
                  </div>
                ) : (
                  <Tabs
                    type="card"
                    size="small"
                    items={Object.entries(monthlyLeaderboard).map(([spaceId, participants]) => ({
                      key: `monthly-${spaceId}`,
                      label: (
                        <Space>
                          <span>{spaceId}</span>
                          <Badge count={participants.length} size="small" />
                        </Space>
                      ),
                      children: (
                        <Table
                          columns={monthlyColumns}
                          dataSource={participants}
                          pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) =>
                              `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
                                'recording.pagation.num',
                              )}, ${t('recording.pagation.total')} ${total} ${t(
                                'recording.pagation.num',
                              )}`,
                          }}
                          scroll={{ x: 600 }}
                        />
                      ),
                    }))}
                  />
                ),
            },
          ]}
        />
      </Card>
      <Modal
        title={t('dashboard.conf.resolution')}
        open={openConf}
        onCancel={() => {
          setOpenConf(false);
        }}
        footer={
          <Button type="primary" onClick={confirmConfHandle}>
            {!isHostManager ? t('dashboard.conf.verify') : t('dashboard.conf.close')}
          </Button>
        }
      >
        {isHostManager ? (
          <ConfQulity
            space=""
            isOwner={isHostManager}
            messageApi={messageApi}
            onReload={() => {
              setHostToken('');
              setOpenConf(false);
              setIsHostManager(false);
              messageApi.success(t('dashboard.conf.success.update'));
            }}
          ></ConfQulity>
        ) : (
          <Input
            placeholder={t('dashboard.conf.placeholder')}
            value={hostToken}
            onChange={(e) => {
              setHostToken(e.target.value);
            }}
          ></Input>
        )}
      </Modal>
    </div>
  );
}
