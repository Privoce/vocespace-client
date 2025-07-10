// lib/hooks/useRoomSettings.ts
import { useState, useCallback } from 'react';
import { connect_endpoint } from '../std';
import { socket } from '@/app/[roomName]/PageClientImpl';
import { ParticipantSettings, RecordSettings, RoomSettings } from '../std/room';

const ROOM_SETTINGS_ENDPOINT = connect_endpoint('/api/room-settings');

export function useRoomSettings(roomId: string, participantId: string) {
  const [settings, setSettings] = useState<RoomSettings>({
    participants: {},
    ownerId: '',
    record: { active: false },
    startAt: Date.now(),
    children: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 获取所有参与者设置
  const fetchSettings = useCallback(async () => {
    if (!roomId) return;

    try {
      const url = new URL(ROOM_SETTINGS_ENDPOINT, window.location.origin);
      url.searchParams.append('roomId', roomId);

      setLoading(true);
      const response = await fetch(url.toString());

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
  }, [roomId]);

  const updateRecord = useCallback(
    async (active: boolean, egressId?: string, filePath?: string) => {
      const url = new URL(ROOM_SETTINGS_ENDPOINT, window.location.origin);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          record: {
            active,
            egressId,
            filePath,
          },
        }),
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
    [participantId, roomId],
  );

  const updateOwnerId = useCallback(
    async (replacedId?: string) => {
      const url = new URL(ROOM_SETTINGS_ENDPOINT, window.location.origin);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          participantId: replacedId || participantId,
          trans: true,
        }),
      });

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
    [participantId, roomId],
  );

  // 更新当前参与者设置
  const updateSettings = useCallback(
    async (newSettings: Partial<ParticipantSettings>, record?: RecordSettings) => {
      if (!roomId || !participantId) return;

      try {
        const url = new URL(ROOM_SETTINGS_ENDPOINT, window.location.origin);
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            participantId,
            settings: newSettings,
            record,
          }),
        });

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
    [roomId, participantId],
  );

  // 清除参与者设置（离开时）
  const clearSettings = useCallback(
    async (id?: string) => {
      if (!roomId || !participantId) return;
      let removeId = id || participantId;
      try {
        const url = new URL(ROOM_SETTINGS_ENDPOINT, window.location.origin);
        await fetch(url.toString(), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            participantId: removeId,
          }),
        }).then(async (res) => {
          if (res.ok) {
            const data: { success: boolean; clearRoom?: string } = await res.json();
            if (data.clearRoom && data.clearRoom !== '') {
              socket.emit('clear_room_resources', { roomName: data.clearRoom });
            }
          }
        });
      } catch (err) {
        console.error('Error clearing settings:', err);
      }
    },
    [roomId, participantId],
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
