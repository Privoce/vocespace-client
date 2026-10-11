import {
  meetingVector,
  settingsVector,
  settingsIcons,
  type SettingsIconName,
  type MeetingVectorName,
} from '@vocespace/ui';
import { VectorIcon } from './SettingsIcon';
import SettingsSlider from '@ant-design/react-native/lib/slider';
import { View, StyleSheet } from 'react-native';
import type { MeetingButtonProps, MeetingIconProps, MeetingInputProps } from '@vocespace/ui';
import { PrimaryButton, Input } from './controls';
import { primaryButtonStyles } from '../theme';
const icons = {
  microphone: 'microphone',
  camera: 'camera',
  screen: 'lkScreen',
  chat: 'chat',
  more: 'more',
  leave: 'lkLeave',
  copy: 'copy',
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
  return (
    <VectorIcon
      node={
        source in settingsIcons
          ? settingsVector(source as SettingsIconName, size, color)
          : meetingVector(source as MeetingVectorName, size, color)
      }
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
        ...(appearance === 'plain'
          ? {
              underlayStyle: {
                width: '100%',
                height: 'auto',
                alignItems: 'center',
                justifyContent: 'center',
              },
              container: {
                width: '100%',
                height: 'auto',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              },
              rawText: { width: '100%' },
            }
          : {}),
      }}
      style={StyleSheet.flatten([
        styles.button,
        circle && styles.circle,
        appearance === 'icon' && styles.iconButton,
        appearance === 'plain' && styles.plain,
        (appearance === 'danger' || appearance === 'destructive') && styles.danger,
        active && styles.active,
        active && circle && styles.activeCircle,
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
    backgroundColor: '#1E252E',
    borderColor: '#FFFFFF16',
    paddingHorizontal: 10,
  },
  circle: { width: 44, height: 44, borderRadius: 22, paddingHorizontal: 0 },
  iconButton: { backgroundColor: 'transparent', borderWidth: 0 },
  plain: {
    width: '100%',
    minHeight: 60,
    height: 'auto',
    paddingVertical: 12,
    borderWidth: 0,
    borderRadius: 12,
  },
  danger: { borderColor: '#FF4D4F', backgroundColor: '#24171A' },
  active: { backgroundColor: '#22CCEE', borderColor: '#22CCEE' },
  activeCircle: { backgroundColor: '#153B46', borderColor: '#22CCEE' },
  content: { alignItems: 'center', justifyContent: 'center', minHeight: 24 },
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
