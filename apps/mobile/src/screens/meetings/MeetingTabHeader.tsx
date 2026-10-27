import { Pressable, Text, View } from 'react-native';
import { useI18n } from '../../i18n';
import { meetingTabStyles as s, palette as c } from './styles';
export type MeetingTab = 'mine' | 'plaza';
export function MeetingTabHeader({
  selected,
  onSelect,
}: {
  selected: MeetingTab;
  onSelect: (tab: MeetingTab) => void;
}) {
  const { t } = useI18n();
  return (
    <View style={s.header}>
      <View style={s.tabs}>
        {(['mine', 'plaza'] as const).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: selected === tab }}
            onPress={() => onSelect(tab)}
            style={s.tab}
          >
            <Text style={[s.tabText, selected === tab && { color: c.text }]}>
              {t(`meeting_tab.${tab}`)}
            </Text>
            {selected === tab && <View style={s.underline} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
