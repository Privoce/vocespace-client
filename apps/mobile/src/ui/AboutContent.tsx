import { Pressable, Text, View } from 'react-native';
import { useLegalNavigation } from '../legal/hooks/useLegalNavigation';
import { useMemo, useCallback } from 'react';
import Toast from '@ant-design/react-native/lib/toast';
import { AboutSettingsContent } from '@vocespace/ui';
import { createSettingsElements, settingsStyleNames } from './settings-elements';
import { SettingsIcon } from './SettingsIcon';
import { useI18n } from '../i18n';
export function AboutContent({ fullPage = false }: { fullPage?: boolean }) {
  const { t } = useI18n();
  const openLegal = useLegalNavigation();
  const onError = useCallback(() => Toast.fail(t('native_settings.open_failed')), [t]);
  const elements = useMemo(() => createSettingsElements(onError), [onError]);
  const legalLinks = (
    <View
      style={{
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: 24,
        paddingTop: 12,
      }}
    >
      {(['privacy', 'terms'] as const).map((document) => (
        <Pressable
          key={document}
          accessibilityRole="link"
          onPress={() => openLegal(document)}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <Text style={{ color: '#22CCEE', fontSize: 14 }}>{t(`legal.${document}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
  const content = AboutSettingsContent({
    elements,
    styles: settingsStyleNames,
    t,
    logo: <SettingsIcon name="logo" size={64} />,
    legalLinks: fullPage ? undefined : legalLinks,
  });
  if (!fullPage) return content;
  return (
    <View style={{ flexGrow: 1, justifyContent: 'space-between', gap: 24 }}>
      {content}
      {legalLinks}
    </View>
  );
}
