import type { PlatformUser,SearchParams } from '@/lib/std';
import type { MessageInstance } from 'antd/es/message/interface';

export interface PageClientImplProps extends SearchParams {
  spaceName: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  data?: PlatformUser;
  messageApi: MessageInstance;
}

