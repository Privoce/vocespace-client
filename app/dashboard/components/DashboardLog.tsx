import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Badge, Space, Button, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useI18n } from '@/lib/i18n/i18n';
import { connect_endpoint } from '@/lib/std';

export type LogType = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: LogType;
}

export interface CleanupRecord {
  id: string;
  timestamp: Date;
  roomName: string;
  userCount: number;
  strategy: 'ghost_room' | 'redis_no_livekit';
}

interface DashboardLogProps {
  logs?: LogEntry[];
  maxLogs?: number;
  title?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const LOG_COLORS: Record<LogType, string> = {
  info: '#ffffff',
  warn: '#faad14',
  error: '#ff4d4f',
};

const LOG_BADGE_STATUS: Record<LogType, 'success' | 'warning' | 'error' | 'default'> = {
  info: 'success',
  warn: 'warning',
  error: 'error',
};

const STRATEGY_LABELS: Record<CleanupRecord['strategy'], string> = {
  ghost_room: 'dashboard.log.strategy.ghost_room',
  redis_no_livekit: 'dashboard.log.strategy.redis_no_livekit',
};

const getBaseUrl = () => connect_endpoint('/api/space');

export const DashboardLog: React.FC<DashboardLogProps> = ({
  logs: externalLogs,
  maxLogs = 200,
  title,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}) => {
  const { t } = useI18n();
  const [internalLogs, setInternalLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // 清理记录状态
  const [cleanupRecords, setCleanupRecords] = useState<CleanupRecord[]>([]);
  const [cleanupTotal, setCleanupTotal] = useState(0);
  const [cleanupPage, setCleanupPage] = useState(1);
  const [cleanupPageSize] = useState(10);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const logs = externalLogs ?? internalLogs;

  // 从 API 获取日志
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getBaseUrl()}?heartbeatLog=true&limit=${maxLogs}`);
      if (response.ok) {
        const { logs: fetchedLogs } = await response.json();
        // 转换时间戳为 Date 对象
        const convertedLogs = fetchedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
        setInternalLogs(convertedLogs.reverse()); // 反转使最新的在最后
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch heartbeat logs:', error);
    } finally {
      setLoading(false);
    }
  }, [maxLogs]);

  // 获取清理记录
  const fetchCleanupRecords = useCallback(
    async (page: number = 1) => {
      try {
        setCleanupLoading(true);
        const response = await fetch(
          `${getBaseUrl()}?cleanupRecords=true&page=${page}&pageSize=${cleanupPageSize}`,
        );
        if (response.ok) {
          const { records, total } = await response.json();
          const convertedRecords = records.map((record: any) => ({
            ...record,
            timestamp: new Date(record.timestamp),
          }));
          setCleanupRecords(convertedRecords);
          setCleanupTotal(total);
          setCleanupPage(page);
        }
      } catch (error) {
        console.error('Failed to fetch cleanup records:', error);
      } finally {
        setCleanupLoading(false);
      }
    },
    [cleanupPageSize],
  );

  // 清空日志
  const clearLogs = async () => {
    try {
      if (externalLogs) {
        console.warn('Cannot clear external logs');
        return;
      }
      const response = await fetch(`${getBaseUrl()}?clearHeartbeatLog=true`);
      if (response.ok) {
        setInternalLogs([]);
      }
    } catch (error) {
      console.error('Failed to clear heartbeat logs:', error);
    }
  };

  // 清空清理记录
  const clearCleanupRecords = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}?clearCleanupRecords=true`);
      if (response.ok) {
        setCleanupRecords([]);
        setCleanupTotal(0);
      }
    } catch (error) {
      console.error('Failed to clear cleanup records:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    if (!externalLogs && autoRefresh) {
      fetchLogs();
      fetchCleanupRecords();
    }
  }, [externalLogs, autoRefresh, fetchLogs, fetchCleanupRecords]);

  // 定时刷新
  useEffect(() => {
    if (!externalLogs && autoRefresh) {
      const timer = setInterval(fetchLogs, refreshInterval);
      const cleanupTimer = setInterval(fetchCleanupRecords, refreshInterval);
      return () => {
        clearInterval(timer);
        clearInterval(cleanupTimer);
      };
    }
  }, [externalLogs, autoRefresh, refreshInterval, fetchLogs, fetchCleanupRecords]);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const latestLog = logs[logs.length - 1];

  // 清理记录表格列定义
  const cleanupColumns: ColumnsType<CleanupRecord> = [
    {
      title: t('dashboard.log.columns.time'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 120,
      render: (timestamp: Date) => formatTime(timestamp),
    },
    {
      title: t('dashboard.log.columns.room'),
      dataIndex: 'roomName',
      key: 'roomName',
      ellipsis: true,
    },
    {
      title: t('dashboard.log.columns.user_count'),
      dataIndex: 'userCount',
      key: 'userCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.userCount - b.userCount,
    },
    {
      title: t('dashboard.log.columns.strategy'),
      dataIndex: 'strategy',
      key: 'strategy',
      width: 150,
      render: (strategy: CleanupRecord['strategy']) => (
        <Tag color={strategy === 'ghost_room' ? 'orange' : 'blue'}>
          {t(STRATEGY_LABELS[strategy])}
        </Tag>
      ),
      filters: [
        { text: t('dashboard.log.strategy.ghost_room'), value: 'ghost_room' },
        { text: t('dashboard.log.strategy.redis_no_livekit'), value: 'redis_no_livekit' },
      ],
      onFilter: (value, record) => record.strategy === String(value),
    },
  ];

  return (
    <>
      {/* 清理记录表格 */}
      <Card
        title={t('dashboard.log.cleanup_title')}
        extra={
          <Space>
            <Button size="small" onClick={() => fetchCleanupRecords(cleanupPage)}>
              {t('dashboard.log.refresh')}
            </Button>
            <Button
              size="small"
              onClick={clearCleanupRecords}
              disabled={cleanupRecords.length === 0}
            >
              {t('dashboard.log.clear')}
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Table<CleanupRecord>
          columns={cleanupColumns}
          dataSource={cleanupRecords}
          rowKey="id"
          loading={cleanupLoading}
          pagination={{
            current: cleanupPage,
            pageSize: cleanupPageSize,
            total: cleanupTotal,
            onChange: (page) => fetchCleanupRecords(page),
            showSizeChanger: false,
            showTotal: () => t('dashboard.log.pagination_total', { total: cleanupTotal }),
          }}
          locale={{ emptyText: t('dashboard.log.no_cleanup') }}
          size="small"
        />
      </Card>

      {/* 心跳日志 */}
      <Card
        title={
          <Space>
            {title || t('dashboard.log.title')}
            {latestLog && (
              <Badge
                status={LOG_BADGE_STATUS[latestLog.type]}
                text={formatTime(latestLog.timestamp)}
              />
            )}
            {lastRefresh && (
              <span style={{ color: '#999', fontSize: 12 }}>
                Last refresh: {formatTime(lastRefresh)}
              </span>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button size="small" loading={loading} onClick={fetchLogs}>
              {t('dashboard.log.refresh')}
            </Button>
            <Button
              size="small"
              onClick={() => setAutoScroll(!autoScroll)}
              type={autoScroll ? 'primary' : 'default'}
            >
              {autoScroll ? t('dashboard.log.auto_scroll_on') : t('dashboard.log.auto_scroll_off')}
            </Button>
            <Button size="small" onClick={clearLogs} disabled={logs.length === 0}>
              {t('dashboard.log.clear')}
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <div
          ref={logContainerRef}
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            backgroundColor: '#141414',
            padding: 12,
            borderRadius: 4,
            fontFamily: 'Monaco, Menlo, Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: '#666', textAlign: 'center', padding: '20px 0' }}>
              {loading ? t('dashboard.log.loading') : t('dashboard.log.no_logs')}
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                style={{
                  color: LOG_COLORS[log.type],
                  marginBottom: 4,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                <span style={{ color: '#666' }}>[{formatTime(log.timestamp)}]</span>{' '}
                <span
                  style={{
                    color:
                      log.type === 'error'
                        ? '#ff4d4f'
                        : log.type === 'warn'
                          ? '#faad14'
                          : '#52c41a',
                    marginRight: 8,
                  }}
                >
                  [{log.type.toUpperCase()}]
                </span>
                {log.message}
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
};
