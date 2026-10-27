import { useEffect, type ReactNode, type RefObject } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { accountStyles as s } from './styles';
import { IconOutline } from '../ui/controls';
import { useI18n } from '../i18n';
export function ProfilePage({
  title,
  children,
  onBack,
  busy = false,
  scrollRef,
}: {
  title: string;
  children: ReactNode;
  onBack: () => void;
  busy?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack, busy]);
  return (
    <View style={s.screen}>
      <View style={[s.row, { padding: 16, borderBottomWidth: 1, borderColor: '#333' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          disabled={busy}
          onPress={onBack}
          style={{ padding: 10 }}
        >
          <IconOutline name="left" size={22} color="#ccc" />
        </Pressable>
        <Text style={[s.title, { flex: 1 }]}>{title}</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}
