import { ContractError } from './connection';
export interface NativeRecording {
  key: string;
  size: number;
  lastModified: number | null;
}
export interface NativeRecords {
  configured: boolean;
  canDelete: boolean;
  records: NativeRecording[];
}
export function parseNativeRecords(value: unknown): NativeRecords {
  const data = value as NativeRecords;
  if (
    !data ||
    typeof data.configured !== 'boolean' ||
    typeof data.canDelete !== 'boolean' ||
    !Array.isArray(data.records)
  )
    throw new ContractError('INVALID_RECORDS');
  return {
    configured: data.configured,
    canDelete: data.canDelete,
    records: data.records.map((item) => {
      if (
        !item ||
        typeof item.key !== 'string' ||
        typeof item.size !== 'number' ||
        !Number.isFinite(item.size) ||
        item.size < 0 ||
        (item.lastModified !== null &&
          (typeof item.lastModified !== 'number' || !Number.isFinite(item.lastModified)))
      )
        throw new ContractError('INVALID_RECORDS');
      return { key: item.key, size: item.size, lastModified: item.lastModified };
    }),
  };
}
