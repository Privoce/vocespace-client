'use client';

import { EnvData, RecordData } from '@/lib/std/recording';
import { Modal, Typography } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
export const { Text } = Typography;

export const { confirm } = Modal;

export interface RecordingTableProps {
  messageApi: MessageInstance;
  env: EnvData | null;
  currentRoom: string;
  setRecordsData: React.Dispatch<React.SetStateAction<RecordData[]>>;
  recordsData: RecordData[];
  expandable?: boolean;
}
