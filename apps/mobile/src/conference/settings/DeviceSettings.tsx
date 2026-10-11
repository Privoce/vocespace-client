import { View } from 'react-native';
import { Button, SettingsNote, SettingsSelect } from '../../ui/settings-widgets';
import { SettingsIcon } from '../../ui/SettingsIcon';
import type { RoomSettingsModel } from './RoomSettingsPanel';
export function DeviceSettings({
  model,
  kind,
}: {
  model: RoomSettingsModel;
  kind: 'audioinput' | 'videoinput';
}) {
  const { t, devices: controls } = model;
  const camera = kind === 'videoinput';
  const label = t(camera ? 'settings.video.device' : 'settings.audio.device');
  const options = controls.devices[kind].map((device, index) => ({
    value: device.deviceId,
    label: device.label || `${label} ${index + 1}`,
  }));
  return (
    <View style={{ gap: 8 }}>
      <SettingsSelect
        label={label}
        icon={<SettingsIcon name={camera ? 'video' : 'audio'} color="#22CCEE" size={16} />}
        value={controls.selected[kind] || ''}
        options={options}
        disabled={controls.busy || !options.length}
        onChange={(id) => {
          void controls.select(kind, id);
        }}
      />
      {!options.length && (
        <SettingsNote>
          {t(camera ? 'native_settings.no_camera' : 'native_settings.no_microphone')}
        </SettingsNote>
      )}
      {!camera && (
        <>
          <SettingsNote>{t('native_settings.audio_output')}</SettingsNote>
          <SettingsSelect
            label={t('native_settings.audio_output')}
            value={controls.selected.audiooutput || ''}
            options={controls.devices.audiooutput.map((device) => ({
              value: device.deviceId,
              label: t(`native_settings.routes.${device.deviceId}`),
            }))}
            disabled={controls.busy || !controls.devices.audiooutput.length}
            onChange={(id) => {
              void controls.select('audiooutput', id);
            }}
          />
          {controls.routePicker && (
            <Button
              onPress={() => {
                void controls.routePicker?.();
              }}
            >
              {t('native_settings.route_picker')}
            </Button>
          )}
        </>
      )}
      <Button
        disabled={controls.busy}
        onPress={() => {
          void controls.refresh();
        }}
      >
        {t('native_settings.refresh_devices')}
      </Button>
      {controls.error && <SettingsNote>{t('native_settings.device_error')}</SettingsNote>}
    </View>
  );
}
