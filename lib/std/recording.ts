import { apiFetch } from '@/lib/api/client';
import { useLatestCallback } from '@/lib/hooks/use-latest-callback';
import { useEffect, useMemo, useState } from 'react';
import { connect_endpoint, isUndefinedString } from '.';
import { MessageInstance } from 'antd/es/message/interface';
import { useI18n } from '../i18n/i18n';
import { api } from '../api';

export enum RecordState {
  // 获取环境变量状态，表示需要获取环境变量
  GetEnv,
  // 初始化状态，在初始状态时需要尝试连接s3服务
  Init,
  // 连接状态，表示已经连接到s3服务
  Connected,
  // 无法连接，表示无法连接到s3服务或后端服务没有部署s3服务或前端没有配置s3服务
  UnAvailable,
}

export interface EnvData {
  configured?: boolean;
  s3_bucket?: string;
  s3_region?: string;
  server_host?: string;
}

export interface RecordItem {
  key: string;
  size: number;
  last_modified: number;
}

export interface RecordData extends RecordItem {
  id: string;
}

export interface RecordResponse {
  records: RecordItem[];
  success: boolean;
}

const CONNECT_ENDPOINT = connect_endpoint('/api/record');

export function useRecordingEnv(messageApi: MessageInstance) {
  const [env, setEnv] = useState<EnvData | null>(null);
  const { t } = useI18n();
  const [state, setState] = useState<RecordState>(RecordState.GetEnv);
  const notify = useLatestCallback((kind: 'success' | 'error', key: string) => {
    messageApi[kind](t(key));
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const initialize = async () => {
      const url = new URL(CONNECT_ENDPOINT, window.location.origin);
      url.searchParams.set('env', 'true');
      const response = await apiFetch(url.toString(), { signal: controller.signal });
      if (!response.ok) throw new Error('Recording capabilities unavailable');
      const { configured, s3_bucket, s3_region, server_host }: EnvData = await response.json();
      if (!active) return;
      if (configured === false || isUndefinedString(s3_bucket) ||
          isUndefinedString(s3_region) || isUndefinedString(server_host)) {
        throw new Error('Recording is not configured');
      }
      // Whitelist the capability fields even when talking to an older server.
      setEnv({ configured: true, s3_bucket, s3_region, server_host });
      setState(RecordState.Init);
      notify('success', 'recording.try_s3.init');
      const check = await api.testS3Connection(controller.signal);
      if (!check.ok) throw new Error('Recording storage check failed');
      const result = await check.json();
      if (!active) return;
      if (!result.success) throw new Error('Recording storage unavailable');
      setState(RecordState.Connected);
      notify('success', 'recording.try_s3.connected');
    };
    void initialize().catch(() => {
      if (!active) return;
      setState(RecordState.UnAvailable);
      notify('error', 'recording.try_s3.connect_error');
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [notify]);

  const isConnected = useMemo(() => {
    switch (state) {
      case RecordState.GetEnv:
        return t('recording.try_s3.enving');
      case RecordState.Init:
        return t('recording.try_s3.connecting');
      case RecordState.Connected:
        return t('recording.try_s3.connected');
      case RecordState.UnAvailable:
        return t('recording.try_s3.unconnect');
      default:
        return '';
    }
  }, [state, t]);

  return { env, state, isConnected };
}
