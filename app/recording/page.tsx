'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Card, Input, Button, Typography, Tag, message, Tooltip, Empty, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { connect_endpoint, isUndefinedString } from '@/lib/std';
import { ulid } from 'ulid';
import { useSearchParams } from 'next/navigation';
import { RecordingTable } from './table';
import {
  EnvData,
  RecordData,
  RecordResponse,
  RecordState,
  useRecordingEnv,
} from '@/lib/std/recording';

const { Title, Text } = Typography;

const CONNECT_ENDPOINT = connect_endpoint('/api/record');

function RecordsPageContent() {
  const searchParams = useSearchParams();
  const [roomName, setRoomName] = useState<string>('');
  const [recordsData, setRecordsData] = useState<RecordData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string>('');
  const [messageApi, contextHolder] = message.useMessage();
  // const [state, setState] = useState<RecordState>(RecordState.GetEnv);
  // const [env, setEnv] = useState<EnvData | null>(null);
  const { env, state, isConnected } = useRecordingEnv(messageApi);

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setRoomName(roomParam);
      // 如果S3服务已连接，自动搜索该房间的录制文件
      if (state === RecordState.Connected) {
        searchRoomRecords(roomParam);
      }
    }
  }, [searchParams, state]);

  // 搜索房间录制数据
  const searchRoomRecords = async (room?: string) => {
    let seachRoom = room || roomName.trim();

    if (!seachRoom) {
      messageApi.warning('请输入房间名');
      return;
    }

    setSearchLoading(true);
    try {
      // 这里应该调用实际的API接口
      const response = await fetch(`${env?.server_host}/api/s3/${seachRoom}`);

      if (response.ok) {
        const { records, success }: RecordResponse = await response.json();
        if (success && records.length > 0) {
          let formattedRecords: RecordData[] = records.map((record) => ({
            ...record,
            id: ulid(), // 使用 ulid 生成唯一 ID
          }));

          setRecordsData(formattedRecords);
          // key 分割第一个 / 之前的部分作为房间名
          let realRoom = records[0].key.split('/')[0];
          setCurrentRoom(realRoom);
          messageApi.success('查找录制文件成功');
          return;
        }
      }
      messageApi.error(
        '查找录制文件为空，请检查房间名是否正确，房间内可能没有录制视频文件或已经删除',
      );
      setRecordsData([]);
      setCurrentRoom('');
    } catch (error) {
      console.error('Search failed:', error);
      messageApi.error('网络错误，请稍后重试');
      setRecordsData([]);
      setCurrentRoom('');
    } finally {
      setSearchLoading(false);
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    if (currentRoom) {
      searchRoomRecords(currentRoom);
    }
  };

  return (
    <div style={{ padding: 24, background: '#000', minHeight: '100vh' }}>
      {contextHolder}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'inline-flex',
            gap: 8,
            width: '100%',
            alignItems: 'center',
            paddingBottom: '12px',
          }}
        >
          <Title level={2} style={{ margin: 0 }}>
            录制文件管理
          </Title>
          <div>
            <Tag color="blue">{isConnected}</Tag>
          </div>
        </div>
        <Text>输入房间名查找并管理该房间的录制视频文件</Text>
      </div>

      {/* 搜索区域 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'inline-flex', justifyContent: 'space-between' }}>
            <Input
              style={{
                width: 'calc(100% - 100px)',
              }}
              placeholder="请输入房间名"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => searchRoomRecords()}>
              搜索
            </Button>
          </div>
          {currentRoom && (
            <Tooltip title="刷新数据">
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={searchLoading}>
                刷新
              </Button>
            </Tooltip>
          )}
        </div>
        {currentRoom && (
          <div style={{ marginTop: 16 }}>
            <Text strong>当前房间：{currentRoom} &nbsp;</Text>

            <Text>共 {recordsData.length} 个文件</Text>
          </div>
        )}
      </Card>

      {/* 文件列表 */}
      <Card title="录制文件列表">
        {!currentRoom ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="请输入房间名并搜索以查看录制文件"
          />
        ) : (
          <Spin spinning={searchLoading}>
            <RecordingTable
              currentRoom={currentRoom}
              messageApi={messageApi}
              env={env}
              setRecordsData={setRecordsData}
              recordsData={recordsData}
            ></RecordingTable>
          </Spin>
        )}
      </Card>
    </div>
  );
}

// 添加一个加载组件
function RecordsPageFallback() {
  return (
    <div style={{ padding: 24, background: '#000', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginTop: '20%' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#fff' }}>loading...</div>
      </div>
    </div>
  );
}

// 主导出组件
export default function RecordsPage() {
  return (
    <Suspense fallback={<RecordsPageFallback />}>
      <RecordsPageContent />
    </Suspense>
  );
}
