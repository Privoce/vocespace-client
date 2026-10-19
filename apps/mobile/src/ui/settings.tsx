import { View } from 'react-native';
import type { MeetingButtonProps, MeetingInputProps } from '@vocespace/ui';
import { PrimaryButton, Input } from './controls';

/** Settings-only controls match Web's existing Radio/Button/Input tokens. */
export function PhoneSettingsButton({
  children,
  onPress = () => {},
  disabled,
  active,
  appearance,
  label,
  size = 'large',
  position,
}: Omit<MeetingButtonProps, 'onPress'> & {
  onPress?: () => void;
  size?: 'small' | 'default' | 'large';
  position?: 'first' | 'middle' | 'last';
}) {
  const height = size === 'small' ? 24 : size === 'default' ? 32 : 40;
  const option = appearance === 'option';
  const color = disabled ? '#333333' : active ? '#22CCEE' : '#AAAAAA';
  return (
    <PrimaryButton
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      type={option ? 'ghost' : active ? 'primary' : 'ghost'}
      disabled={disabled}
      onPress={onPress}
      style={{
        height,
        minHeight: height,
        borderRadius: 12,
        ...(position
          ? {
              borderTopLeftRadius: position === 'first' ? 4 : 0,
              borderBottomLeftRadius: position === 'first' ? 4 : 0,
              borderTopRightRadius: position === 'last' ? 4 : 0,
              borderBottomRightRadius: position === 'last' ? 4 : 0,
              marginLeft: position === 'first' ? 0 : -1,
              zIndex: active ? 1 : 0,
            }
          : {}),
        ...(option ? { flex: 1 } : {}),
        borderWidth: 1,
        backgroundColor: option ? (active ? '#1E1E1E' : '#2E2E2E') : active ? '#22CCEE' : '#1E1E1E',
        borderColor: active || !option ? '#22CCEE' : '#1E1E1E',
      }}
      styles={{
        ghostRawText: { color: option ? color : '#8c8c8c', fontSize: size === 'large' ? 16 : 14 },
        ghostDisabledRawText: { color: '#333333', fontSize: size === 'large' ? 16 : 14 },
        primaryRawText: { color: '#1E1E1E', fontSize: size === 'large' ? 16 : 14 },
      }}
    >
      {typeof children === 'string' ? children : <View>{children}</View>}
    </PrimaryButton>
  );
}
export function PhoneSettingsInput({
  value,
  onChangeText,
  placeholder,
  disabled,
  maxLength,
  secure,
  multiline,
  onSubmit,
}: Omit<MeetingInputProps, 'placeholder' | 'onSubmit'> & {
  placeholder?: string;
  onSubmit?: () => void;
}) {
  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      accessibilityLabel={placeholder}
      editable={!disabled}
      inputStyle={{ color: disabled ? '#8c8c8c' : '#ffffff', fontSize: 16 }}
      maxLength={maxLength}
      secureTextEntry={secure}
      multiline={multiline && !secure}
      onSubmitEditing={onSubmit}
      style={{
        minHeight: 40,
        borderWidth: 1,
        borderColor: '#304753',
        borderRadius: 12,
        backgroundColor: '#1A2832',
        paddingHorizontal: 12,
      }}
    />
  );
}
