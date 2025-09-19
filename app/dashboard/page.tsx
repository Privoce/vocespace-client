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
import { RTCConf } from '@/lib/std/conf';
import { SpaceDateRecords, SpaceInfo, SpaceInfoMap } from '@/lib/std/space';

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
  status: string;
  isOwner: boolean;
  isRecording: boolean;
  virtualEnabled: boolean;
  during: string;
}

export default function Dashboard() {
  const [currentSpacesData, setCurrentSpacesData] = useState<ParticipantTableData[]>([]);
  const [historySpacesData, setHistorySpacesData] = useState<HistorySpaceData[]>([]);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<{ [spaceId: string]: LeaderboardData[] }>({});
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<{ [spaceId: string]: LeaderboardData[] }>({});
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<{ [spaceId: string]: LeaderboardData[] }>({});
  const [loading, setLoading] = useState(false);
  const [totalSpaces, setTotalSpaces] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [activeRecordings, setActiveRecordings] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [openConf, setOpenConf] = useState(false);
  const [isHostManager, setIsHostManager] = useState(false);
  const [hostToken, setHostToken] = useState('');
  const { conf, getConf } = useVoceSpaceConf();

  // 根据 Space 分组数据
  const groupedSpacesData = useMemo(() => {
    const grouped: { [spaceId: string]: ParticipantTableData[] } = {};
    currentSpacesData.forEach((participant) => {
      if (!grouped[participant.spaceId]) {
        grouped[participant.spaceId] = [];
      }
      grouped[participant.spaceId].push(participant);
    });
    return grouped;
  }, [currentSpacesData]);
  // 获取当前空间信息
  const fetchCurrentSpaces = async () => {
    setLoading(true);
    try {
      const response = await api.allSpaceInfos();
      if (response.ok) {
        const spaceInfoMap: SpaceInfoMap = await response.json();

        const participantsData: ParticipantTableData[] = [];
        let roomCount = 0;
        let participantCount = 0;
        let recordingCount = 0;

        Object.entries(spaceInfoMap).forEach(([spaceId, spaceInfo]: [string, any]) => {
          if (spaceInfo.participants && Object.keys(spaceInfo.participants).length > 0) {
            roomCount++;
            if (spaceInfo.record?.active) {
              recordingCount++;
            }

            Object.entries(spaceInfo.participants).forEach(
              ([participantId, participant]: [string, any]) => {
                participantCount++;
                participantsData.push({
                  key: `${spaceId}-${participantId}`,
                  spaceId,
                  participantId,
                  name: participant.name,
                  volume: participant.volume,
                  blur: participant.blur,
                  screenBlur: participant.screenBlur,
                  status: participant.status,
                  isOwner: spaceInfo.ownerId === participantId,
                  isRecording: spaceInfo.record?.active || false,
                  virtualEnabled: participant.virtual?.enabled || false,
                  during: countDuring(participant.startAt),
                });
              },
            );
          }
        });

        setCurrentSpacesData(participantsData);
        setTotalSpaces(roomCount);
        setTotalParticipants(participantCount);
        setActiveRecordings(recordingCount);
      }
    } catch (error) {
      console.error('Failed to fetch current rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取历史房间数据
  const fetchHistorySpaces = async () => {
    const response = await api.historySpaceInfos();
    if (!response.ok) {
      messageApi.error('获取历史房间数据失败');
      return;
    } else {
      const { records }: { records: SpaceDateRecords | null } = await response.json();
      if (records) {
        // 转为 HistorySpaceData 格式
        const historyData: HistorySpaceData[] = [];
        const dailyData: { [spaceId: string]: LeaderboardData[] } = {};
        const weeklyData: { [spaceId: string]: LeaderboardData[] } = {};
        const monthlyData: { [spaceId: string]: LeaderboardData[] } = {};

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
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
            during: `${Math.floor(totalSpaceDuration / 3600000)}h ${Math.floor((totalSpaceDuration % 3600000) / 60000)}m`,
            today: `${Math.floor(todaySpaceDuration / 3600000)}h ${Math.floor((todaySpaceDuration % 3600000) / 60000)}m`,
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

              // 计算日榜
              if (record.start >= todayStart && record.start <= todayEnd) {
                if (end > todayEnd) {
                  dailyDuration += todayEnd - record.start;
                } else {
                  dailyDuration += duration;
                }
              }

              // 计算周榜
              if (record.start >= weekStart && record.start <= weekEnd) {
                if (end > weekEnd) {
                  weeklyDuration += weekEnd - record.start;
                } else {
                  weeklyDuration += duration;
                }
              }

              // 计算月榜
              if (record.start >= monthStart && record.start <= monthEnd) {
                if (end > monthEnd) {
                  monthlyDuration += monthEnd - record.start;
                } else {
                  monthlyDuration += duration;
                }
              }
            });

            if (totalDuration > 0) {
              dailyParticipants[participantName] = { total: totalDuration, period: dailyDuration };
              weeklyParticipants[participantName] = { total: totalDuration, period: weeklyDuration };
              monthlyParticipants[participantName] = { total: totalDuration, period: monthlyDuration };
            }
          });

          // 转换为LeaderboardData格式
          const formatDuration = (ms: number) => {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            return `${hours}h ${minutes}m`;
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
      }
    }
  };

  useEffect(() => {
    getConf();
    fetchCurrentSpaces();
    fetchHistorySpaces();

    // 每120秒刷新一次数据
    const interval = setInterval(() => {
      fetchCurrentSpaces();
      fetchHistorySpaces();
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  // 当前房间参与者表格列定义（去掉房间列，因为现在按Space分组显示）
  const currentSpacesColumns: ColumnsType<ParticipantTableData> = [
    {
      title: '参与者',
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => <Tag color="blue">{status}</Tag>,
    },
    {
      title: (
        <div className={styles.table_header}>
          <SvgResource type="volume" svgSize={16} color="#ffffff"></SvgResource>音量
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
          <SvgResource type="blur" svgSize={16} color="#ffffff"></SvgResource>视频模糊
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
          <SvgResource type="blur" svgSize={16} color="#ffffff"></SvgResource>屏幕模糊
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
      title: '虚拟背景',
      dataIndex: 'virtualEnabled',
      key: 'virtualEnabled',
      width: 100,
      render: (enabled: boolean) => (
        <Badge status={enabled ? 'success' : 'default'} text={enabled ? '启用' : '禁用'} />
      ),
    },
    {
      title: '参会时长',
      dataIndex: 'during',
      key: 'during',
      width: 100,
      ellipsis: true,
    },
  ];

  // 历史房间表格列定义
  const historySpacesColumns: ColumnsType<HistorySpaceData> = [
    {
      title: '房间名',
      dataIndex: 'room',
      key: 'room',
      width: 200,
    },
    {
      title: '总使用时长',
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
      title: '今日使用时长',
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
      title: '用户名',
      dataIndex: 'participantName',
      key: 'participantName',
      width: 150,
    },
    {
      title: `${periodTitle}时长`,
      dataIndex: 'periodDisplay',
      key: 'periodDisplay',
      width: 120,
      sorter: (a, b) => a.periodDuration - b.periodDuration,
      defaultSortOrder: 'descend',
    },
    {
      title: '总时长',
      dataIndex: 'totalDisplay',
      key: 'totalDisplay',
      width: 120,
      sorter: (a, b) => a.totalDuration - b.totalDuration,
    },
  ];

  const dailyColumns = createLeaderboardColumns('日');
  const weeklyColumns = createLeaderboardColumns('周');
  const monthlyColumns = createLeaderboardColumns('月');

  const confirmConfHandle = () => {
    if (!isHostManager) {
      // 验证hostToken
      console.warn(conf?.hostToken, hostToken);
      if (conf) {
        if (hostToken === conf.hostToken) {
          setIsHostManager(true);
        }
      } else {
        messageApi.error('配置未加载完成或无法获得配置，请稍后再试');
      }
    } else {
      // 当修改后
      setOpenConf(false);
      setIsHostManager(false);
      setHostToken('');
    }
  };

  return (
    <div className={styles.container}>
      {contextHolder}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>VoceSpace Dashboard</Title>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="活跃房间数" value={totalSpaces} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="在线参与者"
                value={totalParticipants}
                prefix={<SvgResource type="user" svgSize={16} color="#ffffff"></SvgResource>}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="活跃录制"
                value={activeRecordings}
                prefix={<SvgResource type="record" svgSize={16} color="#ffffff"></SvgResource>}
                valueStyle={{ color: activeRecordings > 0 ? '#cf1322' : undefined }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <div style={{ marginBottom: '9px' }}>操作</div>
              <div style={{ display: 'inline-flex', gap: '8px' }}>
                <Button type="primary" onClick={fetchCurrentSpaces} loading={loading}>
                  刷新数据
                </Button>
                <Button
                  color="danger"
                  variant="solid"
                  onClick={() => {
                    setOpenConf(true);
                  }}
                >
                  配置画质(全局)
                </Button>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* 当前房间用户数据 - 按Space分组 */}
      <Card style={{ marginBottom: 24 }}>
        {Object.keys(groupedSpacesData).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>暂无活跃房间</div>
        ) : (
          <>
            <Typography.Title level={5}>当前活跃用户</Typography.Title>
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
                      showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
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
      <Card  style={{ marginBottom: 24 }}>
        <Tabs
          items={[
            {
              key: 'history',
              label: '历史房间统计',
              children: (
                <Table
                  columns={historySpacesColumns}
                  dataSource={historySpacesData}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                  }}
                />
              ),
            },
            {
              key: 'daily',
              label: '日榜',
              children: Object.keys(dailyLeaderboard).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>暂无日榜数据</div>
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
                          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
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
              label: '周榜',
              children: Object.keys(weeklyLeaderboard).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>暂无周榜数据</div>
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
                          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
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
              label: '月榜',
              children: Object.keys(monthlyLeaderboard).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>暂无月榜数据</div>
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
                          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
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
        title="配置全局画质"
        open={openConf}
        onCancel={() => {
          setOpenConf(false);
        }}
        footer={
          <Button type="primary" onClick={confirmConfHandle}>
            {!isHostManager ? '验证' : '关闭'}
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
              messageApi.success('配置已更新');
            }}
          ></ConfQulity>
        ) : (
          <Input
            placeholder="请输入管理员令牌"
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
