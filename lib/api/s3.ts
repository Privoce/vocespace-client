import { connect_endpoint } from '../std';

export interface S3ConnectResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface S3ObjectMetadata {
  key: string;
  size: number;
  last_modified: number | null;
}

export interface S3RecordsResponse {
  success: boolean;
  records?: S3ObjectMetadata[];
  error?: string;
}

export interface S3DownloadUrlResponse {
  success: boolean;
  url?: string;
  error?: string;
}

export interface S3DeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 测试 S3 连接
 */
export const testS3Connection = (): Promise<Response> => {
  const url = new URL(connect_endpoint('/api/s3'), window.location.origin);
  url.searchParams.set('action', 'connect');
  return fetch(url.toString());
};

/**
 * 获取房间录制记录
 */
export const getS3Records = (room: string): Promise<Response> => {
  const url = new URL(connect_endpoint('/api/s3'), window.location.origin);
  url.searchParams.set('action', 'records');
  url.searchParams.set('room', room);
  return fetch(url.toString());
};

/**
 * 生成下载链接
 */
export const generateS3DownloadUrl = (key: string): Promise<Response> => {
  const url = new URL(connect_endpoint('/api/s3'), window.location.origin);
  url.searchParams.set('action', 'download');
  url.searchParams.set('key', key);
  return fetch(url.toString(), {
    method: 'POST',
  });
};

/**
 * 删除 S3 对象
 */
export const deleteS3Object = (key: string): Promise<Response> => {
  const url = new URL(connect_endpoint('/api/s3'), window.location.origin);
  url.searchParams.set('action', 'delete');
  url.searchParams.set('key', key);
  return fetch(url.toString(), {
    method: 'DELETE',
  });
};
