import { useEffect, useRef } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { PhoneSettingsNavigation } from '@vocespace/ui';
import { IconOutline } from '../ui/controls';
import { SettingsIcon } from '../ui/SettingsIcon';
import { Button, SettingsNote } from '../ui/settings-widgets';
import { RoomSettingsPanel } from './settings/RoomSettingsPanel';
import type { useRoomSettings } from './useRoomSettings';
const icons = {
  general: 'setting',
  profile: 'smile',
  auth: 'auth',
  ai: 'ai',
  audio: 'audio',
  video: 'video',
  app: 'app',
  recording: 'record',
  license: 'license',
  about_us: 'logo',
} as const;
export function RoomSettings({ model }: { model: ReturnType<typeof useRoomSettings> }) {
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [model.selected]);
  return (
    <ScrollView
      ref={scroll}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: '#121C24' }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <PhoneSettingsNavigation
        hideHeader
        groupLabels={[
          model.t('phone_meeting.preferences'),
          model.t('phone_meeting.devices'),
          model.t('more.title'),
        ]}
        hostLabel={model.snapshot?.room?.isOwner ? model.t('more.participant.host') : undefined}
        onlineLabel={model.t('phone_meeting.online')}
        name={model.name}
        spaceName={model.spaceName}
        panels={model.panels.map((panel) => ({
          id: panel.id,
          label: (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <SettingsIcon name={icons[panel.id]} size={20} color="#9CB3C0" />
              <Text
                style={{
                  fontSize: model.selected ? 18 : 14,
                  color: '#E7EDF5',
                  fontWeight: model.selected ? '600' : '400',
                }}
              >
                {panel.label}
              </Text>
            </View>
          ),
        }))}
        activePanel={model.selected}
        onSelect={model.select}
        onBack={() => model.select(undefined)}
        backLabel={model.t('native_settings.back')}
        nextIcon={<IconOutline name="right" size={14} color="#E7EDF5" />}
        backIcon={<IconOutline name="arrow-left" size={16} color="#EDF2FA" />}
      />
      {model.error && (
        <View style={{ paddingHorizontal: 16 }}>
          <SettingsNote>{model.t(model.error)}</SettingsNote>
          {model.error === 'native_settings.read_error' && (
            <Button disabled={model.loading} onPress={model.retry}>
              {model.t('native_settings.retry')}
            </Button>
          )}
        </View>
      )}
      {model.visited.map((panel) => (
        <View
          key={panel}
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            display: model.selected === panel ? 'flex' : 'none',
          }}
        >
          <RoomSettingsPanel model={model} panel={panel} />
        </View>
      ))}
    </ScrollView>
  );
}
