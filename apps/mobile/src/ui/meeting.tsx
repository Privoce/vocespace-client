import { meetingIconSource, meetingButtonVisual } from '@vocespace/ui';
import { VectorIcon } from './SettingsIcon';
import SettingsSlider from '@ant-design/react-native/lib/slider';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { MeetingButtonProps, MeetingIconProps, MeetingInputProps } from '@vocespace/ui';
import { PrimaryButton, Input } from './controls';
import { primaryButtonStyles, ui } from '../theme';
export function MeetingIcon(props: MeetingIconProps) {
  return <VectorIcon node={meetingIconSource(props)} />;
}
export function MeetingButton({
  children,
  appearance,
  label,
  active,
  disabled,
  onPress,
}: MeetingButtonProps) {
  const member = appearance === 'memberAction' || appearance === 'memberDanger';
  const visual = meetingButtonVisual({ appearance, active, disabled });
  // Rich cards own their layout; keep Ant's fixed-height text wrappers for simple controls.
  if (appearance === 'plain' || appearance === 'row')
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, selected: active }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          width: '100%',
          minHeight: 44,
          ...(appearance === 'row' ? { borderRadius: 12 } : {}),
          ...visual,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        })}
      >
        {typeof children === 'string' ? (
          <Text style={{ color: visual.color, padding: 12, textAlign: 'center' }}>{children}</Text>
        ) : (
          children
        )}
      </Pressable>
    );
  const control = appearance === 'control' || appearance === 'controlDanger';
  const circle = appearance === 'circle' || appearance === 'danger' || appearance === 'icon';
  return (
    <PrimaryButton
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      accessibilityLabel={label}
      size="small"
      type={active || appearance === 'primary' ? 'primary' : undefined}
      disabled={disabled}
      onPress={onPress}
      styles={{
        ...primaryButtonStyles,
        defaultRawText: { color: visual.color },
        defaultDisabledRawText: { color: visual.color },
        primaryRawText: { color: visual.color },
        primaryDisabledRawText: { color: visual.color },
        smallUnderlayContainerRaw: { paddingLeft: 0, paddingRight: 0 },
      }}
      style={StyleSheet.flatten([
        styles.button,
        circle && styles.circle,
        control && {
          width: 48,
          height: 46,
          paddingHorizontal: 0,
        },
        visual,
        member && { width: '100%', height: 98, borderRadius: 14, backgroundColor: appearance === 'memberDanger' ? '#392630' : '#1B2D36', borderColor: appearance === 'memberDanger' ? '#50313E' : '#304651' },
      ])}
    >
      {typeof children === 'string' ? children : <View style={styles.content}>{children}</View>}
    </PrimaryButton>
  );
}
export function MeetingInput({
  value,
  onChangeText,
  placeholder,
  disabled,
  maxLength,
}: MeetingInputProps) {
  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      accessibilityLabel={placeholder}
      editable={!disabled}
      multiline
      maxLength={maxLength}
      style={ui.input}
    />
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    backgroundColor: '#1f1f1f',
    borderColor: '#FFFFFF16',
    paddingHorizontal: 10,
  },
  circle: { width: 44, height: 44, borderRadius: 22, paddingHorizontal: 0 },
  content: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 24 },
});

export function MeetingSettingsInput({
  value,
  onChangeText,
  placeholder,
  disabled,
  maxLength,
  secure,
  multiline,
  onSubmit,
}: MeetingInputProps) {
  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      accessibilityLabel={placeholder}
      editable={!disabled}
      maxLength={maxLength}
      secureTextEntry={secure}
      multiline={multiline && !secure}
      onSubmitEditing={onSubmit}
      style={[ui.input, multiline && { minHeight: 120 }]}
      inputStyle={[ui.inputText, multiline && { textAlignVertical: 'top' }]}
    />
  );
}

/** Ant Design Native range control for shared settings fields. */
export function MeetingSettingsRange({
  label,
  ...props
}: import('@vocespace/ui').MeetingSettingsRangeProps) {
  return (
    <View accessibilityLabel={label} style={{ width: '100%' }}>
      <SettingsSlider {...props} />
    </View>
  );
}
