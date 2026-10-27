import { useState } from 'react';
import { TextInput, Text, View, StyleSheet } from 'react-native';
/** One native input preserves OTP autofill, paste and backspace across the six visual cells. */
export function CodeInput({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <View pointerEvents="none" style={styles.cells}>
        {Array.from({ length: 6 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              focused && index === Math.min(value.length, 5) && { borderColor: '#22CCEE' },
            ]}
          >
            <Text style={styles.digit}>{value[index] || ''}</Text>
          </View>
        ))}
      </View>
      <TextInput
        accessibilityLabel={label}
        value={value}
        editable={!disabled}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: { height: 50 },
  cells: { flexDirection: 'row', gap: 8, height: '100%' },
  cell: {
    flex: 1,
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#424242',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 23, color: '#fff' },
  input: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 24,
  },
});
