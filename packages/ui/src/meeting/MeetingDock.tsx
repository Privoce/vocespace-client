import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import type { MeetingDockProps, MeetingTileActionsProps } from './types';
export function MeetingDock({
  chatLabel,
  expandLabel,
  unread,
  chat,
  onExpand,
  expanded,
  tools,
  toolsOpen,
  Button,
  Icon,
}: MeetingDockProps) {
  const { height } = useWindowDimensions();
  const toolsHeight = Math.min(220, height * 0.26);
  const chatHeight = expanded
    ? Math.max(152, Math.min(420, height * 0.52) - (toolsOpen ? toolsHeight : 0))
    : Math.min(152, height * 0.28);
  return (
    <View style={s.root}>
      <View style={s.tabs}>
        <View style={[s.tab, s.active]}>
          <Text style={[s.label, s.selected]}>{chatLabel}</Text>
          <Text style={s.count}>{unread || 0}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Button appearance="icon" label={expandLabel} onPress={onExpand}>
          <Icon name={expanded ? 'fullscreenExit' : 'fullscreen'} size={18} color="#8CA3B2" />
        </Button>
      </View>
      <View style={{ height: chatHeight, flexShrink: 1, minHeight: 96 }}>{chat}</View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={toolsOpen ? { maxHeight: toolsHeight } : { display: 'none' }}
      >
        {tools}
      </ScrollView>
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
  root: { marginHorizontal: 14, marginTop: 4, marginBottom: 4, flexShrink: 1, minHeight: 0 },
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
