'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Input, Button, Typography, Tag, message, Tooltip, Empty, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { ulid } from 'ulid';
import { RecordingTable } from '@/app/recording/table';
import {
  RecordData,
  RecordResponse,
  useRecordingEnv,
} from '@/lib/std/recording';
import { useI18n } from '@/lib/i18n/i18n';
import { api } from '@/lib/api';

const { Title, Text } = Typography;

export interface RecordingContentProps {
  /** 是否显示外层容器的 padding 和背景 */
  showContainer?: boolean;
  /** 初始房间名（用于 URL 参数自动搜索） */
  initialRoom?: string;
  /** 自动搜索的房间名（当 S3 连接成功后触发） */
  autoSearchRoom?: string;
}

export const RecordingContent: React.FC<RecordingContentProps> = ({
  showContainer = true,
  initialRoom,
  autoSearchRoom,
}) => {
  const { t } = useI18n();
  const [roomName, setRoomName] = useState<string>(initialRoom || '');
  const [recordsData, setRecordsData] = useState<RecordData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string>('');
  const [messageApi, contextHolder] = message.useMessage();
  const { env, isConnected } = useRecordingEnv(messageApi);

  // 搜索房间录制数据
  const searchRoomRecords = useCallback(async (room?: string) => {
    let searchRoom = room || roomName.trim();

    if (!searchRoom) {
      messageApi.warning(t('dashboard.recording.please_input_room'));
      return;
    }

    setSearchLoading(true);
    try {
      const response = await api.getS3Records(searchRoom);

      if (response.ok) {
        const { records, success }: RecordResponse = await response.json();
        if (success && records.length > 0) {
          let formattedRecords: RecordData[] = records.map((record) => ({
            ...record,
            id: ulid(),
          }));

          setRecordsData(formattedRecords);
          let realRoom = records[0].key.split('/')[0];
          setCurrentRoom(realRoom);
          messageApi.success(t('dashboard.recording.search_success'));
          return;
        }
      }
      messageApi.error(t('dashboard.recording.search_empty'));
      setRecordsData([]);
      setCurrentRoom('');
    } catch (error) {
      console.error('Search failed:', error);
      messageApi.error(t('dashboard.recording.network_error'));
      setRecordsData([]);
      setCurrentRoom('');
    } finally {
      setSearchLoading(false);
    }
  }, [roomName, t, messageApi]);

  // 自动搜索
  useEffect(() => {
    if (autoSearchRoom) {
      searchRoomRecords(autoSearchRoom);
    }
  }, [autoSearchRoom, searchRoomRecords]);

  // 刷新数据
  const handleRefresh = () => {
    if (currentRoom) {
      searchRoomRecords(currentRoom);
    }
  };

  const content = (
    <>
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
          <Title level={2} style={{ margin: 0, color: showContainer ? undefined : '#fff' }}>
            {t('dashboard.recording.title')}
          </Title>
          <div>
            <Tag color="blue">{isConnected}</Tag>
          </div>
        </div>
        <Text style={{ color: showContainer ? undefined : '#fff' }}>
          {t('dashboard.recording.description')}
        </Text>
      </div>

      {/* 搜索区域 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'inline-flex', justifyContent: 'space-between' }}>
            <Input
              style={{
                width: 'calc(100% - 100px)',
              }}
              placeholder={t('dashboard.recording.input_placeholder')}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => searchRoomRecords()}>
              {t('dashboard.recording.search')}
            </Button>
          </div>
          {currentRoom && (
            <Tooltip title={t('dashboard.recording.refresh_tooltip')}>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={searchLoading}>
                {t('dashboard.recording.refresh')}
              </Button>
            </Tooltip>
          )}
        </div>
        {currentRoom && (
          <div style={{ marginTop: 16 }}>
            <Text strong>
              {t('dashboard.recording.current_room')}: {currentRoom} &nbsp;
            </Text>
            <Text>
              {t('dashboard.recording.total_files')}: {recordsData.length}
            </Text>
          </div>
        )}
      </Card>

      {/* 文件列表 */}
      <Card title={t('dashboard.recording.list_title')}>
        {!currentRoom ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('dashboard.recording.empty_description')}
          />
        ) : (
          <Spin spinning={searchLoading}>
            <RecordingTable
              currentRoom={currentRoom}
              messageApi={messageApi}
              env={env}
              setRecordsData={setRecordsData}
              recordsData={recordsData}
            />
          </Spin>
        )}
      </Card>
    </>
  );

  if (showContainer) {
    return content;
  }

  return <div style={{ padding: 24, background: '#000', minHeight: '100vh' }}>{content}</div>;
};
