import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PhoneSettingsNavigationProps, PhoneSettingsParts } from './phone-settings-types';

// Phone menu grouping is shared by the App and mobile Web.
const groups = [
  ['general', 'profile', 'auth'],
  ['audio', 'video', 'app', 'ai'],
  ['recording', 'license', 'about_us'],
];

/** Shared Phone composition with optional platform renderers. */
export function PhoneSettingsNavigation({
  name,
  spaceName,
  groupLabels,
  hideHeader,
  hostLabel,
  onlineLabel,
  panels,
  activePanel,
  onSelect,
  onBack,
  backLabel,
  nextIcon,
  backIcon,
  parts: { Menu, Profile, Group, Row, Header } = nativeParts,
}: PhoneSettingsNavigationProps) {
  if (activePanel)
    return hideHeader ? null : (
      <Header
        backIcon={backIcon}
        title={panels.find((panel) => panel.id === activePanel)?.label}
        backLabel={backLabel}
        onBack={onBack}
      />
    );
  return (
    <Menu>
      <Profile
        name={hostLabel ? `${name} · ${hostLabel}` : name}
        spaceName={[onlineLabel, spaceName].filter(Boolean).join(' · ')}
      />
      {groups.map((group, index) => (
        <View key={group[0]}>
          {groupLabels?.[index] && <Text style={styles.groupLabel}>{groupLabels[index]}</Text>}
          <Group>
            {panels
              .filter((panel) => group.includes(panel.id))
              .sort((a, b) => group.indexOf(a.id) - group.indexOf(b.id))
              .map((panel) => (
                <Row nextIcon={nextIcon} key={panel.id} onPress={() => onSelect(panel.id)}>
                  <View style={styles.rowContent}>
                    {panel.icon && <View style={styles.icon}>{panel.icon}</View>}
                    {typeof panel.label === 'string' ? (
                      <Text style={styles.rowLabel}>{panel.label}</Text>
                    ) : (
                      panel.label
                    )}
                  </View>
                </Row>
              ))}
          </Group>
        </View>
      ))}
    </Menu>
  );
}

const nativeParts: PhoneSettingsParts = {
  Menu: ({ children }) => <View style={styles.menu}>{children}</View>,
  Profile: ({ name, spaceName }) => (
    <View style={styles.profile}>
      <View style={styles.avatar}>
        <Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.identity}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.space}>{spaceName}</Text>
      </View>
    </View>
  ),
  Group: ({ children }) => <View style={styles.group}>{children}</View>,
  Row: ({ children, onPress, nextIcon }) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      {typeof children === 'string' ? <Text style={styles.rowLabel}>{children}</Text> : children}
      {nextIcon ?? (
        <Text accessible={false} style={styles.chevron}>
          ›
        </Text>
      )}
    </Pressable>
  ),
  Header: ({ title, backLabel, onBack, backIcon }) => (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        style={styles.back}
      >
        {backIcon ?? (
          <Text accessible={false} style={styles.arrow}>
            ←
          </Text>
        )}
      </Pressable>
      {typeof title === 'string' ? (
        <Text style={styles.heading}>{title}</Text>
      ) : (
        <View style={styles.headingSlot}>{title}</View>
      )}
    </View>
  ),
};

/** Phone-only visual tokens; PC settings retain their original layout. */
const styles = StyleSheet.create({
  groupLabel: {
    color: '#7391A3',
    fontSize: 12,
    marginHorizontal: 22,
    marginTop: 26,
    marginBottom: -6,
  },
  menu: { width: '100%', minWidth: 0, paddingBottom: 16 },
  profile: {
    // Web block margins collapse to a single 16px gap; RN margins do not.
    marginTop: 16,
    marginHorizontal: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#324954',
    backgroundColor: '#1A2832',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF1B',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initial: { fontSize: 20, color: '#EDF2FA' },
  identity: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600', color: '#EDF2FA' },
  space: { fontSize: 12, marginTop: 6, color: '#829EAE' },
  group: {
    // Web block margins collapse to a single 16px gap; RN margins do not.
    marginTop: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2A3D49',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1A2832',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3D49',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingRight: 12,
  },
  icon: { width: 20, height: 20, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, color: '#E7EDF5', flexShrink: 1, textAlign: 'left' },
  chevron: { fontSize: 20, color: '#E7EDF5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF12',
  },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  arrow: { fontSize: 20, color: '#EDF2FA' },
  heading: { fontSize: 18, fontWeight: '600', color: '#EDF2FA', flex: 1, minWidth: 0 },
  headingSlot: { flex: 1, minWidth: 0 },
});
