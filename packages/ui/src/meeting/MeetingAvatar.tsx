import { View, StyleSheet } from 'react-native';

export function MeetingAvatar({
  color,
  speaking,
  small = false,
}: {
  color: string;
  speaking?: boolean;
  small?: boolean;
}) {
  const size = small ? 38 : 96;
  return (
    <View
      style={{
        width: size + (small ? 0 : 44),
        height: size + (small ? 0 : 44),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!small && (
        <>
          <View
            style={[
              styles.ring,
              { width: size + 12, height: size + 12, borderColor: color, opacity: 0.15 },
            ]}
          />
          {speaking && (
            <>
              <View
                style={[
                  styles.ring,
                  { width: size + 28, height: size + 28, borderColor: color, opacity: 0.15 },
                ]}
              />
              <View
                style={[
                  styles.ring,
                  { width: size + 44, height: size + 44, borderColor: color, opacity: 0.08 },
                ]}
              />
            </>
          )}
        </>
      )}
      <View
        style={[
          styles.face,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ]}
      >
        <View style={styles.eyes}>
          {[0, 1].map((key) => (
            <View
              key={key}
              style={{
                width: size * 0.15,
                height: size * 0.17,
                borderRadius: 20,
                backgroundColor: '#F3FFFD',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: size * 0.065,
                  height: size * 0.075,
                  borderRadius: 10,
                  backgroundColor: '#20323D',
                }}
              />
            </View>
          ))}
        </View>
        <View
          style={{
            width: size * 0.16,
            height: speaking ? size * 0.09 : 2,
            borderRadius: 8,
            backgroundColor: '#20323D',
            marginTop: size * 0.12,
          }}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  ring: { position: 'absolute', borderRadius: 100, borderWidth: 3 },
  face: { alignItems: 'center', justifyContent: 'center' },
  eyes: { width: '56%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
