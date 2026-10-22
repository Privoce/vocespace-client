import { MeetingRaisedHand } from './MeetingRaisedHand';
import type { ComponentType, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { type MeetingTile } from '@vocespace/meeting-core';
import type { MeetingIconProps } from '../types';
import { InitialAvatar } from './InitialAvatar';
export function MeetingTileView({
  item,
  width,
  height,
  handLabel,
  onLowerHand,
  video,
  Icon,
  avatar,
  actions,
  compact,
  rail,
}: {
  item: MeetingTile;
  compact?: boolean;
  rail?: boolean;
  width: number | `${number}%`;
  height: number;
  handLabel?: string;
  onLowerHand?: () => void;
  video: ReactNode;
  avatar?: ReactNode;
  actions?: ReactNode;
  Icon?: ComponentType<MeetingIconProps>;
}) {
  return (
    <View
      nativeID={`meeting-tile-${item.id}`}
      style={[styles.tile, { width, height }, item.speaking && styles.speaking]}
    >
      <View style={[StyleSheet.absoluteFill, !compact && { bottom: !rail && actions ? 38 : 0 }]}>
        {item.video ? (
          video
        ) : (
          <View
            style={[styles.placeholder, compact && { alignItems: 'flex-start', paddingLeft: 10 }]}
          >
            {avatar ?? (
              <InitialAvatar name={item.name} size={compact ? 34 : height > 230 ? 104 : 64} />
            )}
          </View>
        )}
      </View>
      <View
        style={
          rail
            ? { position: 'absolute', right: 2, top: 2 }
            : compact
              ? { position: 'absolute', right: 2, top: 0, bottom: 0, justifyContent: 'center' }
              : { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#172229F2' }
        }
      >
        {actions}
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.metadata,
          compact
            ? {
                left: 54,
                right: actions ? 48 : 6,
                bottom: 14,
                flexDirection: 'column',
                alignItems: 'flex-start',
              }
            : actions && !rail
              ? { bottom: 42 }
              : undefined,
        ]}
      >
        <View
          style={[
            styles.identity,
            compact && { maxWidth: '100%', backgroundColor: 'transparent', padding: 0 },
          ]}
        >
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
          {item.owner && Icon ? (
            <Icon name="host" color="#FFAA33" size={14} />
          ) : item.role ? (
            <Text style={styles.role}>{item.role}</Text>
          ) : null}
          <Text numberOfLines={1} style={styles.name}>
            {item.name}
          </Text>
        </View>
        {item.status && (
          <View
            style={[
              styles.status,
              compact && { maxWidth: '100%', backgroundColor: 'transparent', padding: 0 },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: item.statusColor || '#28C776' }]} />
            <Text numberOfLines={1} style={styles.statusText}>
              {item.status}
            </Text>
          </View>
        )}
      </View>
      {Icon && (
        <MeetingRaisedHand
          raised={item.raiseHand}
          label={handLabel}
          onLower={onLowerHand}
          Icon={Icon}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  tile: {
    flexShrink: 0,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1A252C',
    borderWidth: 1,
    borderColor: '#34434C',
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
