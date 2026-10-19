import { Text, View } from 'react-native';
import { participantColor } from '@vocespace/meeting-core';
export function InitialAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: participantColor(name),
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Text style={{ color: '#F1F5F8', fontSize: size * 0.4, fontWeight: '600' }}>
        {Array.from(name.trim())[0]?.toLocaleUpperCase() || '?'}
      </Text>
    </View>
  );
}
