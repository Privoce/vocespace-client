import { RecordingSettings } from './RecordingSettings';
import { DeviceSettings } from './DeviceSettings';
import { LicenseSettings } from './LicenseSettings';
import { View, Text } from 'react-native';
import {
  GeneralSettingsContent,
  ProfileSettingsContent,
  AudioSettingsContent,
  VideoSettingsContent,
  AuthSettingsContent,
  AppSettingsContent,
  AboutSettingsContent,
} from '@vocespace/ui';
import { langOptions } from '@vocespace/i18n';
import { settingsStyleNames } from '../../ui/settings-elements';
import {
  Button,
  Input,
  SettingsChoice,
  SettingsNote,
  SettingsPermissionTable,
  SettingsSelect,
  SettingsSlider,
  SettingsToggle,
} from '../../ui/settings-widgets';
import { SettingsIcon } from '../../ui/SettingsIcon';
import { AvoSettings } from './AvoSettings';
import { VirtualSettings } from './VirtualSettings';
import { AISettings } from './AISettings';
import type { useRoomSettings } from '../useRoomSettings';
export type RoomSettingsModel = ReturnType<typeof useRoomSettings>;
export function RoomSettingsPanel({ model, panel }: { model: RoomSettingsModel; panel: string }) {
  const { t, snapshot, draft, saving } = model;
  const disabled = saving || !snapshot || !model.connected;
  const save = (patch: Parameters<typeof model.save>[0]) => {
    void model.save(patch);
  };
  const common = { t, elements: model.elements, styles: settingsStyleNames };
  const device = (key: 'microphone' | 'camera') => {
    const control = model.actions.find((item) => item.id === key);
    return (
      <>
        <SettingsToggle
          value={model.media[key]}
          disabled={control?.disabled ?? true}
          onChange={(value) => {
            if (value !== model.media[key] && !control?.disabled) control?.onPress();
          }}
        />
        {!snapshot?.room?.isOwner && <SettingsNote>{t('native_settings.media_hint')}</SettingsNote>}
        {model.media.error != null && (
          <SettingsNote>{t('native_settings.device_error')}</SettingsNote>
        )}
      </>
    );
  };
  switch (panel) {
    case 'general':
      return (
        <>
          {GeneralSettingsContent({
            ...common,
            owner: !!snapshot?.room?.isOwner,
            slots: {
              introIcon: <SettingsIcon name="setting" size={24} color="#22CCEE" />,
              language: (
                <SettingsSelect
                  label={t('settings.general.lang')}
                  icon={<SettingsIcon name="lang" color="#22CCEE" size={16} />}
                  value={model.locale}
                  options={langOptions}
                  onChange={model.changeLocale}
                />
              ),
              status: (
                <View style={{ flex: 1 }}>
                  <Input
                    value={draft.status ?? (snapshot ? t(snapshot.status) : '')}
                    disabled={disabled}
                    placeholder={t('settings.general.status.define.placeholder.name')}
                    onChangeText={(status) => model.edit({ status })}
                  />
                </View>
              ),
              saveStatus: (
                <Button
                  tone="primary"
                  disabled={disabled}
                  onPress={() => save({ status: draft.status ?? snapshot!.status })}
                >
                  {t('settings.general.status.define.save')}
                </Button>
              ),
              prompt: (
                <SettingsToggle
                  value={snapshot?.openPromptSound}
                  disabled={disabled}
                  onChange={(openPromptSound) => save({ openPromptSound })}
                />
              ),
              persistence: (
                <SettingsToggle
                  value={snapshot?.room?.persistence}
                  disabled={disabled}
                  onChange={(persistence) => save({ persistence })}
                />
              ),
              guests: (
                <SettingsChoice
                  vertical
                  value={snapshot?.room?.allowGuest}
                  disabled={disabled}
                  options={(['allow', 'link', 'disable'] as const).map((value) => ({
                    value,
                    label: t(`settings.general.conf.allow_guest.${value}`),
                  }))}
                  onChange={(value) => {
                    if (value === 'allow' || value === 'link' || value === 'disable')
                      save({ allowGuest: value });
                  }}
                />
              ),
              dashboard: null,
            },
          })}
        </>
      );
    case 'profile':
      return (
        <>
          {ProfileSettingsContent({
            ...common,
            slots: {
              username: (
                <View style={{ gap: 8 }}>
                  <Input
                    value={draft.name ?? model.name}
                    disabled={disabled}
                    onChangeText={(name) => model.edit({ name })}
                  />
                  <Button
                    tone="primary"
                    disabled={disabled || !draft.name?.trim()}
                    onPress={() => save({ name: draft.name!.trim() })}
                  >
                    {t('settings.general.status.define.save')}
                  </Button>
                </View>
              ),
              avo: (
                <AvoSettings
                  active={model.visible && model.selected === 'profile'}
                  common={common}
                  name={model.name}
                  presets={snapshot?.avoList}
                  disabled={disabled}
                  onSave={(avoList) => model.save({ avoList })}
                />
              ),
            },
          })}
        </>
      );
    case 'auth':
      return (
        <>
          {AuthSettingsContent({
            ...common,
            slots: {
              introIcon: <SettingsIcon name="auth" size={24} color="#22CCEE" />,
              microphone: device('microphone'),
              camera: device('camera'),
              management: <SettingsNote>{t('phone_meeting.manage_permissions')}</SettingsNote>,
              table: (
                <SettingsPermissionTable
                  permissions={draft.permissions ?? snapshot?.permissions}
                  disabled={disabled || !snapshot?.room?.isOwner}
                  onChange={(permissions) =>
                    model.edit({
                      permissions: permissions as NonNullable<typeof snapshot>['permissions'],
                    })
                  }
                />
              ),
              save: snapshot?.room?.isOwner ? (
                <Button
                  tone="primary"
                  disabled={disabled || !draft.permissions}
                  onPress={() => save({ permissions: draft.permissions })}
                >
                  {t('settings.general.status.define.save')}
                </Button>
              ) : null,
            },
          })}
        </>
      );
    case 'audio':
      return (
        <>
          {AudioSettingsContent({
            ...common,
            slots: {
              device: (
                <>
                  <DeviceSettings model={model} kind="audioinput" />
                  {device('microphone')}
                </>
              ),
              volume: (
                <SettingsSlider
                  label={t('settings.audio.volume')}
                  value={snapshot?.volume}
                  disabled={disabled}
                  onChange={(volume) => save({ volume })}
                />
              ),
              noise_suppression: (
                <SettingsToggle
                  value={snapshot?.audioProcessing.noiseSuppression}
                  disabled={disabled}
                  onChange={(value) =>
                    save({
                      audioProcessing: { ...snapshot!.audioProcessing, noiseSuppression: value },
                    })
                  }
                />
              ),
              echo_cancellation: (
                <SettingsToggle
                  value={snapshot?.audioProcessing.echoCancellation}
                  disabled={disabled}
                  onChange={(value) =>
                    save({
                      audioProcessing: { ...snapshot!.audioProcessing, echoCancellation: value },
                    })
                  }
                />
              ),
              auto_gain_control: (
                <SettingsToggle
                  value={snapshot?.audioProcessing.autoGainControl}
                  disabled={disabled}
                  onChange={(value) =>
                    save({
                      audioProcessing: { ...snapshot!.audioProcessing, autoGainControl: value },
                    })
                  }
                />
              ),
            },
          })}
        </>
      );
    case 'video':
      return (
        <>
          {VideoSettingsContent({
            ...common,
            slots: {
              device: (
                <>
                  <DeviceSettings model={model} kind="videoinput" />
                  {device('camera')}
                </>
              ),
              shareAudio: (
                <SettingsToggle
                  value={snapshot?.openShareAudio}
                  disabled={disabled}
                  onChange={(openShareAudio) => save({ openShareAudio })}
                />
              ),
              videoBlur: (
                <SettingsSlider
                  label={t('settings.video.video_blur')}
                  value={snapshot?.blur}
                  disabled={disabled}
                  onChange={(blur) => save({ blur })}
                  max={1}
                  step={0.05}
                />
              ),
              screenBlur: (
                <SettingsSlider
                  label={t('settings.video.screen_blur')}
                  value={snapshot?.screenBlur}
                  disabled={disabled}
                  onChange={(screenBlur) => save({ screenBlur })}
                  max={1}
                  step={0.05}
                />
              ),
              virtual: (
                <VirtualSettings
                  common={common}
                  selected={snapshot?.virtual}
                  disabled={disabled}
                  onSave={(virtual) => save({ virtual })}
                />
              ),
            },
          })}
          <SettingsNote>{t('native_settings.video_preferences_hint')}</SettingsNote>
        </>
      );
    case 'app':
      return (
        <>
          {AppSettingsContent({
            ...common,
            slots: {
              owner: snapshot?.room?.isOwner ? (
                <View style={{ gap: 8 }}>
                  {(['timer', 'countdown', 'todo'] as const).map((app) => (
                    <View key={app}>
                      <Text style={{ color: '#E7EDF5' }}>{t(`more.app.${app}.title`)}</Text>
                      <SettingsToggle
                        value={snapshot.room!.apps.includes(app)}
                        disabled={disabled}
                        onChange={(enabled) =>
                          save({
                            apps: enabled
                              ? [...snapshot.room!.apps, app]
                              : snapshot.room!.apps.filter((value) => value !== app),
                          })
                        }
                      />
                    </View>
                  ))}
                </View>
              ) : null,
              syncLabel: (
                <Text style={{ color: '#E7EDF5', marginVertical: 6 }}>
                  {t('more.app.settings.sync.auth')}:
                </Text>
              ),
              sync: (
                <SettingsChoice
                  value={snapshot?.appAuth}
                  disabled={disabled}
                  onChange={(value) => {
                    if (value === 'read' || value === 'write') save({ appAuth: value });
                  }}
                  options={['read', 'write'].map((value) => ({
                    value,
                    label: t(`more.app.settings.sync.${value}`),
                  }))}
                />
              ),
            },
          })}
        </>
      );
    case 'ai':
      return <AISettings common={common} />;
    case 'recording':
      return <RecordingSettings model={model} common={common} />;
    case 'license':
      return <LicenseSettings common={common} />;
    case 'about_us':
      return AboutSettingsContent({ ...common, logo: <SettingsIcon name="logo" size={64} /> });
    default:
      return null;
  }
}
