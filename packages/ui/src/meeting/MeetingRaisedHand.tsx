import { Pressable, View, StyleSheet } from 'react-native';
import type { MeetingRaisedHandProps } from './types';

/** Like Web RaiseKeeper: read-only for peers; your hand stays until confirmed lowered. */
export function MeetingRaisedHand({
  raised,
  label,
  onLower,
  disabled,
  Icon,
}: MeetingRaisedHandProps) {
  if (!raised) return null;
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable
        accessibilityRole={onLower ? 'button' : 'image'}
        accessibilityLabel={label}
        accessibilityState={{ disabled: !onLower || disabled }}
        disabled={!onLower || disabled}
        onPress={onLower}
        style={styles.badge}
      >
        <Icon name="hand" size={22} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 6, left: 6, zIndex: 20, elevation: 4 },
  badge: {
    minWidth: 40,
    minHeight: 40,
    padding: 9,
    borderRadius: 4,
    backgroundColor: '#00000080',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
