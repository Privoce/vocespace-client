import { View } from 'react-native';
import {
  phoneButtonColors as c,
  type MeetingButtonProps,
  type MeetingInputProps,
} from '@vocespace/ui';
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
  tone = 'default',
}: Omit<MeetingButtonProps, 'onPress'> & {
  onPress?: () => void;
  tone?: 'primary' | 'default' | 'danger';
  size?: 'small' | 'default' | 'large';
  position?: 'first' | 'middle' | 'last';
}) {
  const height = size === 'small' ? 24 : size === 'default' ? 32 : 40;
  const option = appearance === 'option';
  const primary = !option && (active || tone === 'primary');
  const danger = tone === 'danger' || appearance === 'destructive';
  const color = disabled
    ? c.disabledText
    : option
      ? active
        ? c.selectedText
        : c.optionText
      : primary
        ? c.primaryText
        : danger
          ? '#FF4D4F'
          : c.defaultText;
  const backgroundColor = option
    ? c.optionBackground
    : disabled
      ? c.disabledBackground
      : primary
        ? c.primary
        : c.defaultBackground;
  const borderColor = disabled
    ? c.defaultBorder
    : option
      ? c.optionBorder
      : primary
        ? c.primary
        : danger
          ? '#FF4D4F'
          : c.defaultBorder;
  return (
    <PrimaryButton
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      type={primary ? 'primary' : undefined}
      disabled={disabled}
      onPress={onPress}
      style={{
        height,
        minHeight: height,
        borderRadius: 4,
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
        backgroundColor,
        borderColor,
      }}
      styles={{
        defaultRawText: { color, fontSize: size === 'large' ? 16 : 14 },
        defaultDisabledRawText: { color, fontSize: size === 'large' ? 16 : 14 },
        primaryRawText: { color, fontSize: size === 'large' ? 16 : 14 },
        primaryDisabledRawText: { color, fontSize: size === 'large' ? 16 : 14 },
        primaryDisabledRaw: { opacity: 1 },
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
