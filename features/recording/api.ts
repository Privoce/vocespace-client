import { connect_endpoint } from '@/lib/http/paths';
import { RecordSettings } from '@/features/spaces/model';

export interface SendRecordRequestBody {
  spaceName: string;
  type: 'start' | 'stop';
  egressId?: string;
}

export const sendRecordRequest = (data: SendRecordRequestBody): Promise<Response> => {
  const url = new URL(connect_endpoint('/api/record'), window.location.origin);
  return fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
};

export interface UpdateRecordBody {
  spaceName: string;
  record: RecordSettings;
}

/**
 * 更新房间的录制设置
 */
export const updateRecord = async (spaceName: string, record: RecordSettings) => {
  const url = new URL(connect_endpoint('/api/space'), window.location.origin);
  url.searchParams.append('record', 'update');
  return await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      record,
    } as UpdateRecordBody),
  });
};
