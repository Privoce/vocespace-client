import { use_add_user_device } from '@/lib/hooks/store/user_choices';
import { SubjectKey, subscriber } from '@/lib/std/chanel';
import { AddDeviceInfo, default_device } from '@/lib/std/device';
import { RoomAudioRenderer, useLocalParticipant } from '@livekit/components-react';
import { useCallback, useEffect, useState } from 'react';

/**
 * ## AudioRenderer
 * override the default audio renderer to use the user's settings
 */
export function AudioRenderer() {
  // [userinfos] ------------------------------------------------------------------------------
  const [device_settings, set_device_settings] = useState(use_add_user_device());
  const handleSettingChange = useCallback((param?: {data: AddDeviceInfo, identity: String}) => {
    console.log('接收到设置状态变化:');
    if (param) {
      if (param.data.microphone.other != device_settings.microphone.other) {
        set_device_settings(param.data);
      }
    }
  }, []);

  useEffect(() => {
    const setting_subscription = subscriber(SubjectKey.Setting, handleSettingChange);
    return () => {
      setting_subscription?.unsubscribe();
    };
  }, [handleSettingChange]);

  return (
    <RoomAudioRenderer
      volume={device_settings.microphone.other / 100.0}
      // muted={!device_settings.microphone.enabled}
    />
  );
}
