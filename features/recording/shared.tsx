'use client';

import { Typography } from 'antd';
export const { Title, Text } = Typography;

export interface RecordingContentProps {
  /** 是否显示外层容器的 padding 和背景 */
  showContainer?: boolean;
  /** 初始房间名（用于 URL 参数自动搜索） */
  initialRoom?: string;
  /** 自动搜索的房间名（当 S3 连接成功后触发） */
  autoSearchRoom?: string;
}
