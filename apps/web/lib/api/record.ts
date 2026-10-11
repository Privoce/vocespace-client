import { SendRecordRequestBody, UpdateRecordBody } from '@vocespace/domain/requests/record';
export * from '@vocespace/domain/requests/record';
import { apiFetch } from '@/lib/api/client';
import { connect_endpoint } from '@/lib/std/index';
import { RecordSettings } from '@/lib/std/space';

export const sendRecordRequest = (data: SendRecordRequestBody): Promise<Response> => {
  const url = new URL(connect_endpoint('/api/record'), window.location.origin);
  return apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
};

/**
 * 更新房间的录制设置
 */
export const updateRecord = async (spaceName: string, record: RecordSettings) => {
  const url = new URL(connect_endpoint('/api/space'), window.location.origin);
  url.searchParams.append('record', 'update');
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceName,
      record,
    } as UpdateRecordBody),
  });
};
