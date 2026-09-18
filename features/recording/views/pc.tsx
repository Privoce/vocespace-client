'use client';

import { RecordingTable } from '@/app/recording/table';
import { Text, Title } from '@/features/recording/shared';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Spin, Tag, Tooltip } from 'antd';
import type { useRecordings } from '../hooks/useRecordings';
export type RecordingContentModel = ReturnType<typeof useRecordings>;
export function RecordingContentPC({ model }: { model: RecordingContentModel }) {
  const {
    showContainer,
    t,
    roomName,
    setRoomName,
    recordsData,
    setRecordsData,
    searchLoading,
    currentRoom,
    messageApi,
    contextHolder,
    env,
    isConnected,
    searchRoomRecords,
    handleRefresh,
  } = model;
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
}
