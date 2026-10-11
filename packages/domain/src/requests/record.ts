import type { RecordSettings } from '../space';

export interface SendRecordRequestBody {
  spaceName: string;
  type: 'start' | 'stop';
  egressId?: string;
}

export interface UpdateRecordBody {
  spaceName: string;
  record: RecordSettings;
}
