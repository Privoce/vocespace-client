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
          messageApi.success('下载链接已复制到剪贴板');
        } catch (err) {
          console.error('Failed to copy:', err);
          messageApi.error('复制链接失败，请手动复制');
        }
      } else {
        messageApi.error('获取下载链接失败，请稍后重试');
      }
    }
  };

  // 删除文件
  const handleDelete = (record: RecordData) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除录制文件 "${record.key}" 吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
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
              messageApi.success('删除成功');
              return;
            }
          }
          messageApi.error('删除失败');
        } catch (error) {
          console.error('Delete failed:', error);
          messageApi.error('删除失败，请稍后重试');
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
        messageApi.success('下载链接获取成功，文件正在下载');
      } else {
        messageApi.error('下载链接获取失败，请稍后重试或联系管理员进行下载');
      }
    }
  };

  // 表格列定义
  const columns: ColumnsType<RecordData> = useMemo(() => {
    if (expandable) {
      return [
        {
          title: '文件名',
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
          title: '操作',
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
                下载
              </Button>
              <Tooltip title="删除文件">
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                  loading={loading}
                >
                  删除
                </Button>
              </Tooltip>
              <Button
                type="default"
                size="small"
                icon={<ScissorOutlined />}
                onClick={() => copyDownloadLink(record)}
              >
                复制链接
              </Button>
            </Space>
          ),
        },
      ];
    } else {
      return [
        {
          title: '文件名',
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
          title: '文件大小',
          dataIndex: 'size',
          key: 'size',
          width: 100,
          render: (size: number) => <Text>{formatFileSize(size)}</Text>,
          sorter: (a, b) => a.size - b.size,
        },
        {
          title: '最后修改时间',
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
          title: '类型',
          dataIndex: 'key',
          key: 'ty',
          width: 80,
          ellipsis: true,
          render: (key: string) => {
            return (
              <Tag color={key.endsWith('json') ? 'green' : 'blue'}>
                {key.endsWith('json') ? '记录文件' : '视频文件'}
              </Tag>
            );
          },
        },
        {
          title: '操作',
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
                下载
              </Button>
              <Tooltip title="删除文件">
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                  loading={loading}
                >
                  删除
                </Button>
              </Tooltip>
              <Button
                type="default"
                size="small"
                icon={<ScissorOutlined />}
                onClick={() => copyDownloadLink(record)}
              >
                复制链接
              </Button>
            </Space>
          ),
        },
      ];
    }
  }, [expandable]);

  return (
    <Table
      columns={columns}
      dataSource={recordsData}
      rowKey={(record) => record.id}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
      }}
      scroll={{ x: expandable ? 'max-content' : 800 }}
      locale={{
        emptyText: <p style={{color: "#8c8c8c"}}>该房间暂无录制文件</p>,
      }}
      expandable={expandable ? {
       showExpandColumn: true,
        expandedRowRender: (record) => (
          <Descriptions size='small' column={2} bordered styles={{
            label: {
                color: "#8c8c8c",
                backgroundColor: "#1a1a1a",
            }
          }}>
            <Descriptions.Item label="文件名">{record.key}</Descriptions.Item>
            <Descriptions.Item label="文件大小">{formatFileSize(record.size)}</Descriptions.Item>
            <Descriptions.Item label="最后修改时间">
              {new Date(record.last_modified * 1000).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={record.key.endsWith('json') ? 'green' : 'blue'}>
                {record.key.endsWith('json') ? '记录文件' : '视频文件'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        ),
      }: undefined}
    />
  );
}
