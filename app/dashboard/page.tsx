'use client';

import React, { useState, useEffect } from 'react';
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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SvgResource } from '../resources/svg';
import styles from '@/styles/dashboard.module.scss';
import { connect_endpoint } from '@/lib/std';

const { Title } = Typography;

const countDuring = (startAt: number): string => {
  if (!startAt) return '0m';
  const now = Date.now();
  const duration = Math.floor((now - startAt) / 1000); // 秒
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

interface RoomTimeRecord {
  start: number; // 记录开始时间戳
  end?: number; // 记录结束时间戳
}

// 记录房间的使用情况
interface RoomDateRecords {
  [roomId: string]: RoomTimeRecord[];
}

interface HistoryRoomData {
  key: string;
  room: string;
  during: string; // 总使用时长
  today: string; // 今日使用时长
}

interface ParticipantTableData {
  key: string;
  roomId: string;
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

const CONNECT_ENDPOINT = connect_endpoint('/api/room-settings');

export default function Dashboard() {
  const [currentRoomsData, setCurrentRoomsData] = useState<ParticipantTableData[]>([]);
  const [historyRoomsData, setHistoryRoomsData] = useState<HistoryRoomData[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRooms, setTotalRooms] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [activeRecordings, setActiveRecordings] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  // 获取当前房间数据
  const fetchCurrentRooms = async () => {
    setLoading(true);
    try {
      const url = new URL(CONNECT_ENDPOINT, window.location.origin);
      url.searchParams.append('all', 'true');
      url.searchParams.append('detail', 'true');
      const response = await fetch(url.toString());
      if (response.ok) {
        const roomSettings = await response.json();

        const participantsData: ParticipantTableData[] = [];
        let roomCount = 0;
        let participantCount = 0;
        let recordingCount = 0;

        Object.entries(roomSettings).forEach(([roomId, roomData]: [string, any]) => {
          if (roomData.participants && Object.keys(roomData.participants).length > 0) {
            roomCount++;
            if (roomData.record?.active) {
              recordingCount++;
            }

            Object.entries(roomData.participants).forEach(
              ([participantId, participant]: [string, any]) => {
                participantCount++;
                participantsData.push({
                  key: `${roomId}-${participantId}`,
                  roomId,
                  participantId,
                  name: participant.name,
                  volume: participant.volume,
                  blur: participant.blur,
                  screenBlur: participant.screenBlur,
                  status: participant.status,
                  isOwner: roomData.ownerId === participantId,
                  isRecording: roomData.record?.active || false,
                  virtualEnabled: participant.virtual?.enabled || false,
                  during: countDuring(participant.startAt),
                });
              },
            );
          }
        });

        setCurrentRoomsData(participantsData);
        setTotalRooms(roomCount);
        setTotalParticipants(participantCount);
        setActiveRecordings(recordingCount);
      }
    } catch (error) {
      console.error('Failed to fetch current rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取历史房间数据（模拟数据）
  const fetchHistoryRooms = async () => {
    const url = new URL(CONNECT_ENDPOINT, window.location.origin);
    url.searchParams.append('time_record', 'true');
    const response = await fetch(url.toString());
    if (!response.ok) {
      messageApi.error('获取历史房间数据失败');
      return;
    } else {
      const { records }: { records: RoomDateRecords } = await response.json();
      // 转为 HistoryRoomData 格式
      const historyData: HistoryRoomData[] = [];
      const todayStart = new Date().setHours(0, 0, 0, 0);
      const todayEnd = new Date().setHours(23, 59, 59, 999);
      // 遍历records中的记录，只要是todayStart < start < todayEnd的记录就是当天的记录
      // 但也需要处理end > todayEnd的情况，这时候就累加todayEnd - start, 否则就是end - start
      for (const [roomId, timeRecords] of Object.entries(records)) {
        let total = 0;
        let today = 0;
        timeRecords.forEach((record) => {
          // 判断当前end是否存在，不存在就是当前的时间
          const end = record.end || Date.now();
          total += end - record.start;
          if (record.start >= todayStart && record.start <= todayEnd) {
            // 如果开始时间在今天范围内
            if (end > todayEnd) {
              // 如果结束时间超过今天的结束时间
              today += todayEnd - record.start;
            } else {
              // 否则就是正常的结束时间
              today += end - record.start;
            }
          }
        });
        historyData.push({
          key: roomId,
          room: roomId,
          during: `${Math.floor(total / 3600000)}h ${Math.floor((total % 3600000) / 60000)}m`,
          today: `${Math.floor(today / 3600000)}h ${Math.floor((today % 3600000) / 60000)}m`,
        });
      }
      setHistoryRoomsData(historyData);
    }
  };

  useEffect(() => {
    fetchCurrentRooms();
    fetchHistoryRooms();

    // 每60秒刷新一次数据
    const interval = setInterval(() => {
      fetchCurrentRooms();
      fetchHistoryRooms();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // 当前房间参与者表格列定义
  const currentRoomsColumns: ColumnsType<ParticipantTableData> = [
    {
      title: '房间',
      dataIndex: 'roomId',
      key: 'roomId',
      width: 120,
      render: (roomId: string, record) => (
        <Space>
          <span>{roomId}</span>
          {record.isRecording && (
            <SvgResource type="record" svgSize={16} color="#ffffff"></SvgResource>
          )}
        </Space>
      ),
    },
    {
      title: '参与者',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string, record) => (
        <Space align="center">
          <span>{name}</span>
          {record.isOwner && '(host)'}
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
  const historyRoomsColumns: ColumnsType<HistoryRoomData> = [
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

  return (
    <div className={styles.container}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>VoceSpace Dashboard</Title>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="活跃房间数" value={totalRooms} />
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
              <Button type="primary" onClick={fetchCurrentRooms} loading={loading}>
                刷新数据
              </Button>
            </Card>
          </Col>
        </Row>
      </div>

      {/* 当前房间用户数据 */}
      <Card
        title="当前活跃房间用户"
        style={{ marginBottom: 24 }}
        extra={
          <Badge count={totalParticipants} showZero>
            <SvgResource type="user" svgSize={16} color="#ffffff" />
          </Badge>
        }
      >
        <Table
          columns={currentRoomsColumns}
          dataSource={currentRoomsData}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 历史房间数据 */}
      <Card title="历史房间使用统计">
        <Table
          columns={historyRoomsColumns}
          dataSource={historyRoomsData}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
        />
      </Card>
    </div>
  );
}
