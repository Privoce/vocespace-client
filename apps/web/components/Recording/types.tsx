'use client';

import { EnvData, RecordData } from '@/lib/std/recording';
import { Modal, Typography } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
export const { Title, Text } = Typography;

export const { confirm } = Modal;

export interface RecordingContentProps {
  /** 是否显示外层容器的 padding 和背景 */
  showContainer?: boolean;
  /** 初始房间名（用于 URL 参数自动搜索） */
  initialRoom?: string;
  /** 自动搜索的房间名（当 S3 连接成功后触发） */
  autoSearchRoom?: string;
}

export interface RecordingTableProps {
  messageApi: MessageInstance;
  env: EnvData | null;
  currentRoom: string;
  setRecordsData: React.Dispatch<React.SetStateAction<RecordData[]>>;
  recordsData: RecordData[];
  expandable?: boolean;
}
