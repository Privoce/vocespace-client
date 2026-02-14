import { useCallback, useEffect, useMemo, useState } from 'react';
import { connect_endpoint, isUndefinedString } from '.';
import { MessageInstance } from 'antd/es/message/interface';
import { useI18n } from '../i18n/i18n';

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
  s3_access_key?: string;
  s3_secret_key?: string;
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
  const get_env = useCallback(async () => {
    if (env != null) return;

    const url = new URL(CONNECT_ENDPOINT, window.location.origin);
    url.searchParams.set('env', 'true');
    const response = await fetch(url.toString());
    if (response.ok) {
      const { s3_access_key, s3_secret_key, s3_bucket, s3_region, server_host }: EnvData =
        await response.json();

      if (
        isUndefinedString(s3_access_key) ||
        isUndefinedString(s3_secret_key) ||
        isUndefinedString(s3_bucket) ||
        isUndefinedString(s3_region) ||
        isUndefinedString(server_host)
      ) {
        setState(RecordState.UnAvailable);
        messageApi.error(t('recording.try_s3.unavailible'));
      } else {
        setEnv({
          s3_access_key,
          s3_secret_key,
          s3_bucket,
          s3_region,
          server_host,
        });
        setState(RecordState.Init);
        messageApi.success(t('recording.try_s3.init'));
      }
    }
  }, [env]);

  const try_connectS3 = useCallback(async () => {
    try {
      const response = await fetch(`${env?.server_host}/api/s3/connect`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setState(RecordState.Connected);
          messageApi.success(t('recording.try_s3.connected'));
        } else {
          setState(RecordState.UnAvailable);
          messageApi.error(t('recording.try_s3.connect_error'));
        }
      }
    } catch (error) {
      console.error('S3连接测试失败:', error);
      setState(RecordState.UnAvailable);
    }
  }, [env]);

  useEffect(() => {
    switch (state) {
      case RecordState.GetEnv:
        // 获取环境变量
        get_env();
        break;
      case RecordState.Init:
        // 尝试连接S3服务
        try_connectS3();
        break;
      case RecordState.Connected:
        // 已经连接到S3服务，可以进行后续操作
        break;
      case RecordState.UnAvailable:
        // 无法连接到S3服务，提示用户
        messageApi.error(t('recording.try_s3.connect_error'));
        break;
      default:
        break;
    }
  }, [state, get_env, try_connectS3]);

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
