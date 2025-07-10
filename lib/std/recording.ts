import { useCallback, useEffect, useMemo, useState } from 'react';
import { connect_endpoint, isUndefinedString } from '.';
import { MessageInstance } from 'antd/es/message/interface';

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
        messageApi.error('S3服务未配置或环境变量未设置');
      } else {
        setEnv({
          s3_access_key,
          s3_secret_key,
          s3_bucket,
          s3_region,
          server_host,
        });
        setState(RecordState.Init);
        messageApi.success('S3服务环境变量获取成功');
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
          messageApi.success('S3服务连接成功');
        } else {
          setState(RecordState.UnAvailable);
          messageApi.error('S3服务连接失败，请检查配置');
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
        messageApi.error('无法连接到S3服务，当前可能访问了本地服务，请检查配置或联系管理员');
        break;
      default:
        break;
    }
  }, [state, get_env, try_connectS3]);

  const isConnected = useMemo(() => {
    switch (state) {
      case RecordState.GetEnv:
        return '获取环境变量中...';
      case RecordState.Init:
        return '正在连接S3服务...';
      case RecordState.Connected:
        return '已连接到S3服务';
      case RecordState.UnAvailable:
        return '无法连接到S3服务';
      default:
        return '';
    }
  }, [state]);

  return { env, state, isConnected };
}
