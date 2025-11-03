// lib/hooks/useSpaceInfo.ts
import { useState, useCallback } from 'react';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { DEFAULT_SPACE_INFO, ParticipantSettings, RecordSettings, SpaceInfo } from '../std/space';
import { api } from '../api';

export function useSpaceInfo(spaceName: string, participantId: string) {
  const [settings, setSettings] = useState<SpaceInfo>(DEFAULT_SPACE_INFO(Date.now()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 获取空间的设置数据
  const fetchSettings = useCallback(async () => {
    if (!spaceName) return;

    try {
      setLoading(true);
      const response = await api.getSpaceInfo(spaceName);
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`);
      }
      const data = await response.json();
      setSettings(data.settings || {});
      return data.settings || {};
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [spaceName]);

  const updateRecord = useCallback(
    async (active: boolean, egressId?: string, filePath?: string) => {
      const response = await api.updateRecord(spaceName, {
        active,
        egressId,
        filePath,
      });

      if (!response.ok) {
        return false;
      }
      const { record } = await response.json();

      setSettings((prevSettings) => ({
        ...prevSettings,
        record,
      }));
      return true;
    },
    [participantId, spaceName],
  );
  // 转让或设置房间的主持人
  const updateOwnerId = useCallback(
    async (replacedId?: string) => {
      const response = await api.updateOwnerId(spaceName, replacedId || participantId);
      if (!response.ok) {
        return false;
      }

      const { ownerId } = await response.json();
      setSettings((prevSettings) => ({
        ...prevSettings,
        ownerId: ownerId || prevSettings.ownerId,
      }));

      return true;
    },
    [participantId, spaceName],
  );

  // 更新当前参与者设置
  const updateSettings = useCallback(
    async (newSettings: Partial<ParticipantSettings>, record?: RecordSettings, init = false) => {
      if (!spaceName || !participantId) return;
      try {
        const response = await api.updateSpaceParticipant(
          spaceName,
          participantId,
          newSettings,
          record,
          init,
        );
        if (!response.ok) {
          throw new Error(`Failed to update settings: ${response.status}`);
        }
        // 直接执行fetchSettings以获取最新设置
        const data = await fetchSettings();

        return Boolean(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return false;
      }
    },
    [spaceName, participantId],
  );

  // 清除参与者设置（离开时）
  const clearSettings = useCallback(
    async (id?: string) => {
      if (!spaceName || !participantId) return;
      let removeId = id || participantId;
      try {
        await api.leaveSpace(spaceName, removeId, socket);
      } catch (err) {
        console.error('Error clearing settings:', err);
      }
    },
    [spaceName, participantId],
  );

  return {
    settings,
    loading,
    error,
    setSettings,
    updateSettings,
    fetchSettings,
    clearSettings,
    updateOwnerId,
    updateRecord,
  };
}
