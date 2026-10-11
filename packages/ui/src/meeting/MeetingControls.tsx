import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { MeetingControlsProps, MeetingMenuProps } from './types';
export function MeetingControls({ actions, Button, Icon }: MeetingControlsProps) {
  return (
    <View style={styles.toolbar}>
      {actions.map((action) => (
        <View key={action.id} style={styles.action}>
          {action.content || (
            <Button
              label={action.label}
              disabled={action.disabled}
              active={action.active}
              appearance={action.danger ? 'danger' : 'circle'}
              onPress={action.onPress}
            >
              <View style={styles.icon}>
                <Icon
                  name={action.icon}
                  size={21}
                  color={
                    action.disabled
                      ? '#66707A'
                      : action.danger
                        ? '#FF4D4F'
                        : action.active
                          ? '#22CCEE'
                          : '#E7EDF5'
                  }
                />
                {action.muted && <View style={styles.slash} />}
              </View>
            </Button>
          )}
          {!!action.badge && (
            <View pointerEvents="none" style={styles.badge}>
              <Text style={styles.badgeText}>{action.badge > 99 ? '99+' : action.badge}</Text>
            </View>
          )}
          {action.menu && <View style={styles.menu}>{action.menu}</View>}
        </View>
      ))}
    </View>
  );
}
export function MeetingMenu({ actions, Button, Icon }: MeetingMenuProps) {
  return (
    <ScrollView contentContainerStyle={styles.menuList}>
      {actions.map((action) => (
        <Button
          key={action.id}
          label={action.label}
          disabled={action.disabled}
          appearance="plain"
          onPress={action.onPress}
        >
          <View style={styles.menuRow}>
            <Icon name={action.icon} size={22} color="#A9B6C8" />
            <View style={styles.menuText}>
              <Text style={styles.title}>{action.label}</Text>
              {action.description && <Text style={styles.description}>{action.description}</Text>}
            </View>
          </View>
        </Button>
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: '#0B1015',
  },
  action: { position: 'relative', alignItems: 'center' },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  slash: {
    width: 24,
    height: 1.5,
    backgroundColor: '#ADB5C0',
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    borderRadius: 10,
    minWidth: 16,
    paddingHorizontal: 3,
    backgroundColor: '#22CCEE',
  },
  badgeText: { color: '#0B1015', fontSize: 10, textAlign: 'center' },
  menu: { position: 'absolute', right: -5, bottom: -2 },
  menuList: { padding: 12, gap: 8 },
  menuRow: { flexDirection: 'row', gap: 14, alignItems: 'center', width: '100%', padding: 14 },
  menuText: { flex: 1, gap: 5 },
  title: { color: '#F1F5FB', fontSize: 15 },
  description: { color: '#96A5BB', fontSize: 12 },
});
