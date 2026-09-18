'use client';

import { SvgResource } from '@/app/resources/svg';
import { Text } from '@/features/recording-list/shared';
import { RecordData } from '@/lib/std/recording';
import {
  DeleteOutlined,
  DownloadOutlined,
  ScissorOutlined
} from '@ant-design/icons';
import { Button, Descriptions, Space, Table, Tag } from 'antd';
import { ColumnsType } from 'antd/es/table';
import type { useRecordingActions } from '../hooks/useRecordingActions';
export type RecordingTableModel = ReturnType<typeof useRecordingActions>;
export function RecordingTablePC({ model }: { model: RecordingTableModel }) {
  const {
    currentRoom,
    recordsData,
    expandable,
    loading,
    t,
    formatFileSize,
    copyDownloadLink,
    handleDelete,
    handleDownload,
  } = model;
  const columns: ColumnsType<RecordData> = (() => {
    if (expandable) {
      return [
        {
          title: t('recording.table.file'),
          dataIndex: 'key',
          key: 'key',
          width: 150,
          render: (key: string, record) => (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Text strong>{key.replace(`${currentRoom}/`, '')}</Text>
            </div>
          ),
        },
        {
          title: t('recording.table.opt'),
          key: 'action',
          width: 120,
          ellipsis: true,
          render: (_, record) => (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record)}
                loading={loading}
              >
                {t('recording.download.title')}
              </Button>
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
                loading={loading}
              >
                {t('recording.delete.title')}
              </Button>
              <Button
                type="default"
                size="small"
                icon={<ScissorOutlined />}
                onClick={() => copyDownloadLink(record)}
              >
                {t('recording.copy.title')}
              </Button>
            </Space>
          ),
        },
      ];
    } else {
      return [
        {
          title: t('recording.table.file'),
          dataIndex: 'key',
          key: 'key',
          width: 120,
          render: (key: string, record) => (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <SvgResource
                type={key.endsWith('json') ? 'file' : 'video'}
                svgSize={16}
                color="#22CCEE"
              ></SvgResource>
              <Text strong>{key.replace(`${currentRoom}/`, '')}</Text>
            </div>
          ),
        },
        {
          title: t('recording.table.size'),
          dataIndex: 'size',
          key: 'size',
          width: 100,
          render: (size: number) => <Text>{formatFileSize(size)}</Text>,
          sorter: (a, b) => a.size - b.size,
        },
        {
          title: t('recording.table.last_modified'),
          dataIndex: 'last_modified',
          key: 'last_modified',
          width: 180,
          ellipsis: true,
          render: (last_modified: number) => (
            <Text>
              {new Date(last_modified * 1000).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </Text>
          ),
          sorter: (a, b) => a.last_modified - b.last_modified,
        },
        {
          title: t('recording.table.ty'),
          dataIndex: 'key',
          key: 'ty',
          width: 80,
          ellipsis: true,
          render: (key: string) => {
            return (
              <Tag color={key.endsWith('json') ? 'green' : 'blue'}>
                {key.endsWith('json')
                  ? t('recording.table.ty_json')
                  : t('recording.table.ty_video')}
              </Tag>
            );
          },
        },
        {
          title: t('recording.table.opt'),
          key: 'action',
          width: 150,
          render: (_, record) => (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record)}
                loading={loading}
              >
                {t('recording.download.title')}
              </Button>
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
                loading={loading}
              >
                {t('recording.delete.title')}
              </Button>
              <Button
                type="default"
                size="small"
                icon={<ScissorOutlined />}
                onClick={() => copyDownloadLink(record)}
              >
                {t('recording.copy.title')}
              </Button>
            </Space>
          ),
        },
      ];
    }
  })();
  return (
    <Table
      columns={columns}
      dataSource={recordsData}
      rowKey={(record) => record.id}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) =>
          `${t('recording.pagation.now')} ${range[0]}-${range[1]} ${t(
            'recording.pagation.num',
          )}, ${t('recording.pagation.total')} ${total} ${t('recording.pagation.num')}`,
      }}
      scroll={{ x: expandable ? 'max-content' : 800 }}
      locale={{
        emptyText: <p style={{ color: '#8c8c8c' }}>{t('recording.empty')}</p>,
      }}
      expandable={
        expandable
          ? {
            showExpandColumn: true,
            expandedRowRender: (record) => (
              <Descriptions
                size="small"
                column={2}
                bordered
                styles={{
                  label: {
                    color: '#8c8c8c',
                    backgroundColor: '#1a1a1a',
                  },
                }}
              >
                <Descriptions.Item label={t('recording.table.file')}>
                  {record.key}
                </Descriptions.Item>
                <Descriptions.Item label={t('recording.table.size')}>
                  {formatFileSize(record.size)}
                </Descriptions.Item>
                <Descriptions.Item label={t('recording.table.last_modified')}>
                  {new Date(record.last_modified * 1000).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </Descriptions.Item>
                <Descriptions.Item label={t('recording.table.ty')}>
                  <Tag color={record.key.endsWith('json') ? 'green' : 'blue'}>
                    {record.key.endsWith('json')
                      ? t('recording.table.ty_json')
                      : t('recording.table.ty_video')}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            ),
          }
          : undefined
      }
    />
  );
}
