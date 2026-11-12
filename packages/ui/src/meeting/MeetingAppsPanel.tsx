import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MeetingAppsPanelProps } from './types';

/** Phone widgets share their tabs and cards; data, controls and permissions stay in adapters. */
export function MeetingAppsPanel({ name, tabs, active, onChange }: MeetingAppsPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const selected = tabs.some((tab) => tab.id === active) ? active : tabs[0]?.id;
  return (
    <View style={s.root}>
      {!!name && <Text style={s.name}>{name}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabStrip}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: selected === tab.id }}
            onPress={() => onChange(tab.id)}
            style={[s.tab, selected === tab.id && s.activeTab]}
          >
            <Text style={[s.label, selected === tab.id && s.activeLabel]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {tabs.map((tab) => (
        <View key={tab.id} style={[s.card, selected !== tab.id && s.hidden]}>
          <View style={s.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ expanded: !collapsed[tab.id] }}
              style={s.toggle}
              onPress={() => setCollapsed((state) => ({ ...state, [tab.id]: !state[tab.id] }))}
            >
              <View style={[s.chevron, collapsed[tab.id] && s.chevronClosed]} />
            </Pressable>
            <View style={s.heading}>{tab.header || <Text style={s.title}>{tab.label}</Text>}</View>
            {tab.actions}
          </View>
          <View style={collapsed[tab.id] && s.hidden}>{tab.content}</View>
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  root: { width: '100%', paddingBottom: 24 },
  name: { color: '#eee', fontWeight: '600', fontSize: 14, marginBottom: 8 },
  tabStrip: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#aaa', marginBottom: 16 },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#22CCEE' },
  label: { color: '#aaa', fontSize: 14 },
  activeLabel: { color: '#22CCEE' },
  card: { backgroundColor: '#202020', borderRadius: 4, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  heading: { flex: 1, minWidth: 0 },
  title: { color: '#eee', fontSize: 14, fontWeight: '600' },
  toggle: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  chevron: {
    width: 7,
    height: 7,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#abbcc5',
    transform: [{ rotate: '45deg' }],
  },
  chevronClosed: { transform: [{ rotate: '-45deg' }] },
  hidden: { display: 'none' },
});
