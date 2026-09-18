'use client';

import { confirm, RecordingTableProps } from '@/features/recording-list/shared';
import { api } from '@/lib/api';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import { RecordData } from '@/lib/std/recording';
import {
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useState } from 'react';
export function useRecordingActions({
  messageApi,
  env,
  currentRoom,
  setRecordsData,
  recordsData,
  expandable = false,
}: RecordingTableProps) {
  const device = useLayoutDevice();
  const [phonePage, setPhonePage] = useState(1);
  const [phoneSort, setPhoneSort] = useState<'newest' | 'oldest' | 'size' | 'name'>('newest');
  const sortedRecords = [...recordsData].sort((a, b) => phoneSort === 'size' ? b.size - a.size : phoneSort === 'name' ? a.key.localeCompare(b.key) : phoneSort === 'oldest' ? a.last_modified - b.last_modified : b.last_modified - a.last_modified);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const copyDownloadLink = async (record: RecordData) => {
    const response = await api.generateS3DownloadUrl(record.key);
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
          const response = await api.deleteS3Object(record.key);

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
  const handleDownload = async (record: RecordData) => {
    const response = await api.generateS3DownloadUrl(record.key);
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
  return {
    phonePage,
    setPhonePage,
    phoneSort,
    setPhoneSort,
    sortedRecords,
    messageApi,
    env,
    currentRoom,
    setRecordsData,
    recordsData,
    expandable,
    loading,
    setLoading,
    t,
    formatFileSize,
    copyDownloadLink,
    handleDelete,
    handleDownload,
    device,
  };
}
