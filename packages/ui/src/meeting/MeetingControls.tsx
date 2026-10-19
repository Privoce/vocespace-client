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
              appearance={action.danger ? 'controlDanger' : 'control'}
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
          <Text
            numberOfLines={1}
            style={[styles.controlLabel, action.danger && { color: '#DF8290' }]}
          >
            {action.label}
          </Text>
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
export function MeetingMenu({ actions, Button, Icon, footer }: MeetingMenuProps) {
  const featured = actions.filter((action) => action.id === 'hand' || action.id === 'share');
  const order = ['members', 'participant', 'apps', 'app', 'settings', 'setting'];
  const rows = actions
    .filter((action) => action.id !== 'hand' && action.id !== 'share')
    .sort(
      (a, b) =>
        (order.includes(a.id) ? order.indexOf(a.id) : 99) -
        (order.includes(b.id) ? order.indexOf(b.id) : 99),
    );
  return (
    <ScrollView contentContainerStyle={styles.menuList}>
      <View style={styles.featured}>
        {featured.map((action) => (
          <View key={action.id} style={{ flex: 1 }}>
            <Button
              label={action.label}
              disabled={action.disabled}
              appearance="plain"
              onPress={action.onPress}
            >
              <View style={styles.featuredContent}>
                <View
                  style={[
                    styles.featureIcon,
                    action.id === 'hand' && { backgroundColor: '#403725' },
                  ]}
                >
                  <Icon
                    name={action.icon}
                    size={28}
                    color={action.id === 'hand' ? '#E9BD62' : '#22CCEE'}
                  />
                </View>
                <Text style={styles.title}>{action.label}</Text>
                {action.description && <Text style={styles.description}>{action.description}</Text>}
              </View>
            </Button>
          </View>
        ))}
      </View>
      <View style={styles.group}>
        {rows.map((action) => (
          <Button
            key={action.id}
            label={action.label}
            disabled={action.disabled}
            appearance="row"
            onPress={action.onPress}
          >
            <View style={styles.menuRow}>
              <Icon name={action.icon} size={23} color="#98B0BE" />
              <View style={styles.menuText}>
                <Text style={styles.title}>{action.label}</Text>
                {action.description && <Text style={styles.description}>{action.description}</Text>}
              </View>
              <Text style={styles.description}>›</Text>
            </View>
          </Button>
        ))}
      </View>
      {footer && (
        <View style={styles.footer}>
          <Icon name="microphone" size={16} color="#6C8798" />
          <Text style={styles.description}>{footer}</Text>
        </View>
      )}
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
  action: { position: 'relative', alignItems: 'center', flex: 1, minWidth: 0, gap: 7 },
  controlLabel: { color: '#8CA3B2', fontSize: 10, maxWidth: '100%' },
  featured: { flexDirection: 'row', gap: 10 },
  featuredContent: {
    padding: 14,
    gap: 8,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#153C49',
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    gap: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A2832',
    borderWidth: 1,
    borderColor: '#2A3D49',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
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
  menuList: { padding: 20, gap: 20 },
  menuRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    width: '100%',
    padding: 14,
    minHeight: 64,
    borderBottomWidth: 1,
    borderColor: '#2A3D49',
  },
  menuText: { flex: 1, gap: 5 },
  title: { color: '#F1F5FB', fontSize: 15 },
  description: { color: '#829EAE', fontSize: 11, lineHeight: 17 },
});
