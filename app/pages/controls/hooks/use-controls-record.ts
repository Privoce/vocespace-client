import { useState, useMemo, useCallback } from 'react';
import type { Room } from 'livekit-client';
import { api } from '@/lib/api';
import { message } from 'antd';

interface UseControlsRecordOptions {
  space: Room | null | undefined;
  isManager: boolean;
  spaceInfo: any;
  updateRecord: (active: boolean, egressId?: string, filePath?: string) => Promise<boolean>;
}

export function useControlsRecord({ space, isManager, spaceInfo, updateRecord }: UseControlsRecordOptions) {
  const [openRecordModal, setOpenRecordModal] = useState(false);
  const [isDownload, setIsDownload] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const isRecording = useMemo(() => spaceInfo.record.active, [spaceInfo.record]);

  const startRecord = useCallback(async () => {
    if (isRecording || !space) return;
    if (isManager) {
      const response = await api.sendRecordRequest({ spaceName: space.name, type: 'start' });
      if (!response.ok) {
        const { error } = await response.json();
        messageApi.error(error);
      } else {
        const { egressId, filePath } = await response.json();
        messageApi.success({ content: '', duration: 2 });
        const res = await updateRecord(true, egressId, filePath);
        if (!res) {
          console.error('Failed to update record settings');
          // refetch_room handled by parent
        }
      }
    }
  }, [isRecording, space, isManager, messageApi, updateRecord]);

  const onClickRecord = useCallback(async () => {
    if (!space) return;
    if (!isRecording) {
      setOpenRecordModal(true);
    } else {
      if (spaceInfo.record.egressId) {
        const response = await api.sendRecordRequest({
          spaceName: space.name,
          type: 'stop',
          egressId: spaceInfo.record.egressId,
        });
        if (!response.ok) {
          const { error } = await response.json();
          messageApi.error(error);
        } else {
          messageApi.success({ content: '', duration: 2 });
          setIsDownload(true);
          await updateRecord(false);
          setOpenRecordModal(true);
        }
      }
    }
  }, [space, isManager, isRecording, spaceInfo.record.egressId, messageApi, updateRecord]);

  const recordModalOnOk = useCallback(async () => {
    if (!space) return;
    if (isDownload) {
      window.open(`${window.location.origin}/recording?room=${encodeURIComponent(space.name)}`, '_blank');
      setIsDownload(false);
    } else {
      await startRecord();
    }
    setOpenRecordModal(false);
  }, [space, isDownload, startRecord]);

  const recordModalOnCancel = useCallback(() => {
    if (isDownload) setIsDownload(false);
    setOpenRecordModal(false);
  }, [isDownload]);

  return {
    openRecordModal,
    setOpenRecordModal,
    isDownload,
    setIsDownload,
    isRecording,
    onClickRecord,
    recordModalOnOk,
    recordModalOnCancel,
    messageApi,
    contextHolder,
  };
}
