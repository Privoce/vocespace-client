import {
  meetingVector,
  settingsVector,
  settingsIcons,
  type SettingsIconName,
  type MeetingVectorName,
} from '@vocespace/ui';
import { VectorIcon } from './SettingsIcon';
import SettingsSlider from '@ant-design/react-native/lib/slider';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { MeetingButtonProps, MeetingIconProps, MeetingInputProps } from '@vocespace/ui';
import { PrimaryButton, Input } from './controls';
import { primaryButtonStyles } from '../theme';
const icons = {
  microphone: 'microphone',
  camera: 'camera',
  screen: 'lkScreen',
  chat: 'chat',
  more: 'more2',
  leave: 'lkLeave',
  copy: 'copy',
  link: 'link',
  members: 'user',
  close: 'close',
  send: 'send',
  hand: 'hand',
  settings: 'setting',
  file: 'file',
  back: 'back',
  menu: 'menu',
  fullscreen: 'fullscreen',
  fullscreenExit: 'fullscreenExit',
  focus: 'lkFocus',
  unfocus: 'unfocus',
  app: 'app',
  userAdd: 'user_add',
  room: 'public',
  space: 'space',
} as const;
export function MeetingIcon({ name, size = 20, color = '#E7EDF5' }: MeetingIconProps) {
  const source = icons[name];
  const node =
    source in settingsIcons
      ? settingsVector(source as SettingsIconName, size, color)
      : meetingVector(source as MeetingVectorName, size, color);
  // The original LiveKit SVGs use fixed pixel coordinates without a viewBox.
  // Native renders them at several sizes; retain the paths and center their source canvas.
  const canvas = source === 'lkScreen' ? '0 0 20 16' : '0 0 16 16';
  return (
    <VectorIcon
      node={{
        ...node,
        attrs: {
          ...node.attrs,
          viewBox: node.attrs.viewBox || canvas,
          preserveAspectRatio: 'xMidYMid meet',
        },
      }}
    />
  );
}
export function MeetingButton({
  children,
  appearance,
  label,
  active,
  disabled,
  onPress,
}: MeetingButtonProps) {
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
          borderWidth: appearance === 'row' ? 0 : 1,
          borderColor: '#2D414E',
          borderRadius: appearance === 'row' ? 0 : 14,
          backgroundColor: active ? '#22CCEE' : appearance === 'row' ? 'transparent' : '#1A2832',
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        })}
      >
        {typeof children === 'string' ? (
          <Text style={{ color: active ? '#09252D' : '#E7EDF5', padding: 12, textAlign: 'center' }}>
            {children}
          </Text>
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
      type={active ? 'primary' : 'ghost'}
      disabled={disabled}
      onPress={onPress}
      styles={{
        ...primaryButtonStyles,
        smallUnderlayContainerRaw: { paddingLeft: 0, paddingRight: 0 },
      }}
      style={StyleSheet.flatten([
        styles.button,
        circle && styles.circle,
        control && {
          width: 48,
          height: 46,
          borderRadius: 14,
          paddingHorizontal: 0,
          borderColor: '#2D414E',
          backgroundColor: '#1B2A34',
        },
        appearance === 'controlDanger' && { backgroundColor: '#3B222B', borderColor: '#61333E' },
        appearance === 'icon' && styles.iconButton,
        (appearance === 'danger' || appearance === 'destructive') && styles.danger,
        active && styles.active,
        active && (circle || control) && styles.activeCircle,
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
      style={styles.input}
    />
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#1A2832',
    borderColor: '#FFFFFF16',
    paddingHorizontal: 10,
  },
  circle: { width: 44, height: 44, borderRadius: 22, paddingHorizontal: 0 },
  iconButton: { backgroundColor: 'transparent', borderWidth: 0 },
  danger: { borderColor: '#FF4D4F', backgroundColor: '#24171A' },
  active: { backgroundColor: '#22CCEE', borderColor: '#22CCEE' },
  activeCircle: { backgroundColor: '#153B46', borderColor: '#22CCEE' },
  content: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 24 },
  input: {
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: '#1A222C',
    borderRadius: 10,
    borderWidth: 0,
    paddingHorizontal: 12,
  },
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
      style={styles.input}
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
