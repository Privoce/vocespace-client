'use client';
import {
  useLocalParticipantPermissions,
  usePersistentUserChoices,
  useTrackToggle,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Switch } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { useI18n } from '@/lib/i18n/i18n';
/** Uses the same publish permission and explicit-toggle semantics as the control bar. */
export function PhoneDeviceSwitch({
  device,
  messageApi,
}: {
  device: 'microphone' | 'camera';
  messageApi: MessageInstance;
}) {
  const { t } = useI18n();
  const source = device === 'camera' ? Track.Source.Camera : Track.Source.Microphone;
  const permissions = useLocalParticipantPermissions();
  const { saveAudioInputEnabled, saveVideoInputEnabled } = usePersistentUserChoices();
  const toggle = useTrackToggle({ source });
  const allowed =
    !!permissions?.canPublish &&
    (!permissions.canPublishSources?.length ||
      permissions.canPublishSources.includes(Track.sourceToProto(source)));
  return (
    <Switch
      aria-label={t(`common.device.${device}`)}
      checked={toggle.enabled}
      disabled={!allowed || toggle.pending}
      loading={toggle.pending}
      onChange={() => {
        void toggle
          .toggle()
          .then((enabled) => {
            if (typeof enabled === 'boolean')
              (device === 'camera' ? saveVideoInputEnabled : saveAudioInputEnabled)(enabled);
          })
          .catch(() => messageApi.error(t('native_settings.device_error')));
      }}
    />
  );
}
