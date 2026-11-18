import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { MeetingToolsPanelProps } from './types';

/** Inline tool grid; the dock owns expansion. No modal, backdrop or second chat instance. */
export function MeetingToolsPanel({ items, onSelect = () => {} }: MeetingToolsPanelProps) {
  return (
    <View style={s.grid}>
      {items.map((item) => {
        const content = (
          <>
            <View style={s.icon}>
              {typeof item.content === 'function' ? item.content(onSelect) : item.content}
            </View>
            {!!item.label && (
              <Text numberOfLines={2} style={s.label}>
                {item.label}
              </Text>
            )}
          </>
        );
        return item.onPress ? (
          <Pressable
            key={item.id}
            style={[s.item, item.disabled && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ disabled: item.disabled }}
            disabled={item.disabled}
            onPress={item.onPress}
          >
            {content}
          </Pressable>
        ) : (
          <View key={item.id} style={s.item}>
            {content}
          </View>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 12 },
  item: { width: '25%', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 16, gap: 8 },
  icon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#2b3035',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: '#adc1cd', fontSize: 12, textAlign: 'center' },
});
