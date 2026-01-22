import { Button, Descriptions, Modal, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { SvgResource } from '../resources/svg';
import { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  ScissorOutlined,
} from '@ant-design/icons';
import { MessageInstance } from 'antd/es/message/interface';
import { useMemo, useState } from 'react';
import { EnvData, RecordData } from '@/lib/std/recording';
import { useI18n } from '@/lib/i18n/i18n';

const { Text } = Typography;
const { confirm } = Modal;

export interface RecordingTableProps {
  messageApi: MessageInstance;
  env: EnvData | null;
  currentRoom: string;
  setRecordsData: React.Dispatch<React.SetStateAction<RecordData[]>>;
  recordsData: RecordData[];
  expandable?: boolean;
}

export function RecordingTable({
  messageApi,
  env,
  currentRoom,
  setRecordsData,
  recordsData,
  expandable = false,
}: RecordingTableProps) {
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyDownloadLink = async (record: RecordData) => {
    const response = await fetch(`${env?.server_host}/api/s3/download?key=${record.key}`);
    if (response.ok) {
      const {
        success,
        url,
      }: {
        success: boolean;
        url?: string;
      } = await response.json();

      if (success) {
        // 复制链接到剪贴板
        try {
          await navigator.clipboard.writeText(url!);
          messageApi.success(t('recording.copy.success'));
        } catch (err) {
          console.error('Failed to copy:', err);
          messageApi.error(t('recording.copy.error'));
        }
      } else {
        messageApi.error(t('recording.get_download_link.error'));
      }
    }
  };

  // 删除文件
  const handleDelete = (record: RecordData) => {
    confirm({
      title: t('recording.delete.confirm.title'),
      icon: <ExclamationCircleOutlined />,
      content: `${t('recording.delete.confirm.0')} "${record.key}" ${t(
        'recording.delete.confirm.1',
      )}`,
      okText: t('recording.delete.confirm.ok'),
      okType: 'danger',
      cancelText: t('recording.delete.confirm.cancel'),
      onOk: async () => {
        setLoading(true);
        try {
          const response = await fetch(`${env?.server_host}/api/s3/delete?key=${record.key}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            const { success }: { success: boolean } = await response.json();
            if (success) {
              // 从记录数据中删除该记录
              setRecordsData((prev) => {
                return prev.filter((item) => item.id !== record.id);
              });
              messageApi.success(t('recording.delete.success'));
              return;
            }
          }
          messageApi.error(t('recording.delete.error'));
        } catch (error) {
          console.error('Delete failed:', error);
          messageApi.error(t('recording.delete.error'));
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 下载文件
  const handleDownload = async (record: RecordData) => {
    const response = await fetch(`${env?.server_host}/api/s3/download?key=${record.key}`);
    if (response.ok) {
      const {
        success,
        url,
      }: {
        success: boolean;
        url?: string;
      } = await response.json();

      if (success) {
        // 创建一个链接元素并触发下载
        const link = document.createElement('a');
        link.href = url!;
        link.download = record.key;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        messageApi.success(t('recording.download.success'));
      } else {
        messageApi.error(t('recording.download.error'));
      }
    }
  };

  // 表格列定义
  const columns: ColumnsType<RecordData> = useMemo(() => {
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
          sorter: (a, b) => new Date(a.last_modified).getTime(),
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
  }, [expandable, t]);

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
                      backgroundColor: '#f67f22',
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
