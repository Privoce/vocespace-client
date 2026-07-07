import { useState, useRef, useCallback } from 'react';
import type { Room } from 'livekit-client';
import { message } from 'antd';
import { TabKey } from '../settings/settings';
import type { SettingsExports } from '../settings/settings';
import { useUserStore, useRoomStore } from '@/lib/store';
import { getState } from '@/lib/std/space';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import equal from 'fast-deep-equal';

interface UseControlsSettingsOptions {
  space: Room | null | undefined;
  saveUsername: (name: string) => void;
  updateSettings: (s: any) => Promise<boolean | undefined>;
}

export function useControlsSettings({ space, saveUsername, updateSettings }: UseControlsSettingsOptions) {
  const [settingVis, setSettingVis] = useState(false);
  const [key, setKey] = useState<TabKey>('general');
  const settingsRef = useRef<SettingsExports>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const uState = useUserStore();

  const closeSetting = useCallback(async () => {
    if (settingsRef.current && space) {
      settingsRef.current.removeVideo();
      const newName = settingsRef.current.username;
      if (newName !== '' && newName !== (space.localParticipant?.name || space.localParticipant.identity)) {
        saveUsername(newName);
        await space.localParticipant?.setMetadata(JSON.stringify({ name: newName }));
        await space.localParticipant.setName(newName);
        messageApi.success({ content: '', duration: 2 });
      }
      if (!equal(getState(uState), settingsRef.current.state)) {
        await updateSettings(settingsRef.current.state);
        socket.emit('update_user_status', { space: space.name } as WsBase);
      }
      socket.emit('reload_virtual', {
        identity: space.localParticipant.identity,
        roomId: space.name,
        reloading: false,
      });
    }
    useRoomStore.getState().setVirtualMask(false);
  }, [space, saveUsername, updateSettings, uState, messageApi]);

  const openSettings = useCallback(async (tab: TabKey, isDefineStatus?: boolean) => {
    setKey(tab);
    setSettingVis(true);
    if (settingsRef.current && tab === 'video') {
      await settingsRef.current.startVideo();
    }
    if (isDefineStatus) {
      if (settingsRef.current) {
        settingsRef.current.setAppendStatus(true);
      } else {
        let finish = false;
        const interval = setInterval(() => {
          if (settingsRef.current && !finish) {
            settingsRef.current.setAppendStatus(true);
            finish = true;
            clearInterval(interval);
          }
        }, 300);
      }
    }
  }, []);

  return {
    settingVis,
    setSettingVis,
    key,
    setKey,
    settingsRef,
    messageApi,
    contextHolder,
    closeSetting,
    openSettings,
  };
}
