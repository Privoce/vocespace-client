import type { ComponentType, ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { avatarColor, type MeetingTile } from '@vocespace/meeting-core';
import type { MeetingIconProps } from '../types';
import { MeetingAvatar } from './MeetingAvatar';
export function MeetingTileView({
  item,
  width,
  height,
  label,
  onPress,
  video,
  Icon,
  avatar,
  actions,
}: {
  item: MeetingTile;
  width: number | `${number}%`;
  height: number;
  label: string;
  onPress: () => void;
  video: ReactNode;
  avatar?: ReactNode;
  actions?: ReactNode;
  Icon?: ComponentType<MeetingIconProps>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.tile, { width, height }, item.speaking && styles.speaking]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {item.video ? (
          video
        ) : (
          <View style={styles.placeholder}>
            {avatar ?? (
              <MeetingAvatar
                color={item.avatarColor || avatarColor(item.id)}
                speaking={item.speaking}
              />
            )}
          </View>
        )}
      </View>
      <View style={{ position: 'absolute', top: 4, right: 4 }}>{actions}</View>
      <View pointerEvents="none" style={styles.metadata}>
        <View style={styles.identity}>
          {Icon && (
            <View style={styles.mic}>
              <Icon
                name={item.screen ? 'screen' : 'microphone'}
                size={13}
                color={item.microphone ? '#22CCEE' : '#9299A0'}
              />
              {!item.microphone && !item.screen && <View style={styles.slash} />}
            </View>
          )}
          {item.role && <Text style={styles.role}>{item.role}</Text>}
          <Text numberOfLines={1} style={styles.name}>
            {item.name}
          </Text>
        </View>
        {item.status && (
          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: item.statusColor || '#28C776' }]} />
            <Text numberOfLines={1} style={styles.statusText}>
              {item.status}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  tile: {
    flexShrink: 0,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#FFFFFF08',
  },
  speaking: { borderColor: '#22CCEE55' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metadata: {
    position: 'absolute',
    bottom: 7,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  identity: {
    maxWidth: '64%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#090D11CC',
    flexShrink: 1,
  },
  name: { color: '#F1F5FB', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  role: { color: '#FFC56C', fontSize: 10 },
  mic: { position: 'relative' },
  slash: {
    position: 'absolute',
    width: 15,
    height: 1,
    backgroundColor: '#9299A0',
    top: 6,
    transform: [{ rotate: '45deg' }],
  },
  status: {
    maxWidth: '40%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 4,
    backgroundColor: '#090D11CC',
    padding: 3,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: '#F1F5FB', fontSize: 10, flexShrink: 1 },
});
