'use client';

import { RecordingContentProps } from '@/features/recording/shared';
import { api } from '@/lib/api';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import { useI18n } from '@/lib/i18n/i18n';
import {
  RecordData,
  RecordResponse,
  RecordState,
  useRecordingEnv,
} from '@/lib/std/recording';
import { message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ulid } from 'ulid';

export function useRecordings({
  showContainer = true,
  initialRoom,
  autoSearchRoom,
}: RecordingContentProps) {
  const device = useLayoutDevice();
  const requestId = useRef(0);
  const autoSearched = useRef<string>();
  useEffect(() => () => { requestId.current++; }, []);
  const { t } = useI18n();
  const [roomName, setRoomName] = useState<string>(initialRoom || '');
  const [recordsData, setRecordsData] = useState<RecordData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string>('');
  const [messageApi, contextHolder] = message.useMessage();
  const { env, isConnected, state: recordingState } = useRecordingEnv(messageApi);
  const searchRoomRecords = useCallback(async (room?: string) => {
    let searchRoom = room || roomName.trim();

    if (!searchRoom) {
      messageApi.warning(t('dashboard.recording.please_input_room'));
      return;
    }

    const request = ++requestId.current;
    setSearchLoading(true);
    try {
      const response = await api.getS3Records(searchRoom);
      if (request !== requestId.current) return;

      if (response.ok) {
        const { records, success }: RecordResponse = await response.json();
        if (request !== requestId.current) return;
        if (success && records.length > 0) {
          let formattedRecords: RecordData[] = records.map((record) => ({
            ...record,
            id: ulid(),
          }));

          setRecordsData(formattedRecords);
          let realRoom = records[0].key.split('/')[0];
          setCurrentRoom(realRoom);
          messageApi.success(t('dashboard.recording.search_success'));
          return;
        }
      }
      messageApi.error(t('dashboard.recording.search_empty'));
      setRecordsData([]);
      setCurrentRoom('');
    } catch (error) {
      if (request !== requestId.current) return;
      console.error('Search failed:', error);
      messageApi.error(t('dashboard.recording.network_error'));
      setRecordsData([]);
      setCurrentRoom('');
    } finally {
      if (request === requestId.current) setSearchLoading(false);
    }
  }, [roomName, t, messageApi]);
  useEffect(() => {
    if (autoSearchRoom && recordingState === RecordState.Connected && autoSearched.current !== autoSearchRoom) {
      autoSearched.current = autoSearchRoom;
      setRoomName(autoSearchRoom);
      searchRoomRecords(autoSearchRoom);
    }
  }, [autoSearchRoom, searchRoomRecords, recordingState]);
  const handleRefresh = () => {
    if (currentRoom) {
      searchRoomRecords(currentRoom);
    }
  };
  return {
    showContainer,
    initialRoom,
    autoSearchRoom,
    t,
    roomName,
    setRoomName,
    recordsData,
    setRecordsData,
    searchLoading,
    setSearchLoading,
    currentRoom,
    setCurrentRoom,
    messageApi,
    contextHolder,
    env,
    isConnected,
    searchRoomRecords,
    handleRefresh,
    device,
  };
}
