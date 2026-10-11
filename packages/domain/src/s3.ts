// s3 相关类型

export interface S3Config {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export interface ObjectMetadata {
  key: string;
  size: number;
  last_modified: number | null;
}

export interface RecordResponse {
  success: boolean;
  records: ObjectMetadata[];
}

export interface DownloadUrlResponse {
  success: boolean;
  url: string;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

export interface ConnectResponse {
  success: boolean;
  message: string;
}
