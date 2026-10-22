import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import type { MeetingDockProps, MeetingTileActionsProps } from './types';
export function MeetingDock({
  chatLabel,
  membersLabel,
  expandLabel,
  count,
  unread,
  chat,
  members,
  onExpand,
  Button,
  Icon,
}: MeetingDockProps) {
  const [tab, setTab] = useState<'chat' | 'members'>('chat');
  return (
    <View style={s.root}>
      <View style={s.tabs}>
        {(['chat', 'members'] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: key === tab }}
            onPress={() => setTab(key)}
            style={[s.tab, key === tab && s.active]}
          >
            <Text style={[s.label, key === tab && s.selected]}>
              {key === 'chat' ? chatLabel : membersLabel}
            </Text>
            <Text style={s.count}>{key === 'chat' ? unread || 0 : count}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Button appearance="icon" label={expandLabel} onPress={() => onExpand(tab)}>
          <Icon name="fullscreen" size={18} color="#8CA3B2" />
        </Button>
      </View>
      <View
        pointerEvents={tab === 'chat' ? 'auto' : 'none'}
        accessibilityElementsHidden={tab !== 'chat'}
        importantForAccessibility={tab === 'chat' ? 'auto' : 'no-hide-descendants'}
        style={[s.body, tab !== 'chat' && s.hidden]}
      >
        {chat}
      </View>
      <View
        pointerEvents={tab === 'members' ? 'auto' : 'none'}
        accessibilityElementsHidden={tab !== 'members'}
        importantForAccessibility={tab === 'members' ? 'auto' : 'no-hide-descendants'}
        style={[s.body, tab !== 'members' && s.hidden]}
      >
        {members}
      </View>
    </View>
  );
}
export function MeetingTileActions({ actions, Icon }: MeetingTileActionsProps) {
  return (
    <View style={s.actions}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          disabled={action.disabled}
          onPress={(event) => {
            event.stopPropagation();
            action.onPress();
          }}
          style={s.tileAction}
        >
          <Icon name={action.icon} size={18} color="#ADC1CD" />
        </Pressable>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  root: { marginHorizontal: 14, marginTop: 4, marginBottom: 4 },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#293740',
    gap: 18,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  active: { borderColor: '#22CCEE' },
  label: { color: '#829EAE', fontSize: 14 },
  selected: { color: '#E8EFF3', fontWeight: '600' },
  count: {
    color: '#65C9DC',
    fontSize: 11,
    paddingHorizontal: 5,
    borderRadius: 4,
    backgroundColor: '#18333E',
  },
  body: { height: 152 },
  // Fabric must still lay out the retained ScrollView when its data changes.
  // display:none on that subtree can leave dirty Yoga nodes during a parent update.
  hidden:
    Platform.OS === 'web'
      ? { display: 'none' }
      : { position: 'absolute', opacity: 0, zIndex: -1, left: 0, right: 0, bottom: 0 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#33414A',
    paddingVertical: 4,
    width: '100%',
  },
  tileAction: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
  },
});
