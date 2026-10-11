import { useI18n } from '../i18n';
import { ManualJoin } from './ManualJoin';
import type { ComponentProps } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { meetingVector } from '@vocespace/ui';
import { VectorIcon } from '../ui/SettingsIcon';

export function HomeScreen(
  manual: ComponentProps<typeof ManualJoin> & { openMeetings: () => void },
) {
  const { t } = useI18n();
  const logo = meetingVector('logo2');
  return (
    <ScrollView
      style={{ backgroundColor: '#191919' }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, gap: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ alignItems: 'center', gap: 16 }}>
        <VectorIcon node={{ ...logo, attrs: { ...logo.attrs, width: 260, height: 62 } }} />
        <Text style={{ fontSize: 20, fontWeight: '600', textAlign: 'center', color: '#999' }}>
          {t('msg.info.title')}
        </Text>
      </View>
      <ManualJoin {...manual} />
    </ScrollView>
  );
}
