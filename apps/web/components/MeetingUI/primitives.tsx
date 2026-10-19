'use client';
import { createElement, type ReactElement } from 'react';
import {
  meetingVector,
  settingsVector,
  settingsIcons,
  type SettingsVectorNode,
  type SettingsIconName,
  type MeetingVectorName,
} from '@vocespace/ui';
import { Button, Input, type InputRef } from 'antd';
import { useEffect, useRef } from 'react';

import type { MeetingButtonProps, MeetingIconProps, MeetingInputProps } from '@vocespace/ui';
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
  const vector =
    source in settingsIcons
      ? settingsVector(source as SettingsIconName, size, color)
      : meetingVector(source as MeetingVectorName, size, color);
  const render = (node: SettingsVectorNode, key = 0): ReactElement =>
    createElement(node.tag, { ...node.attrs, key }, ...node.children.map(render));
  return render(vector);
}
export function MeetingButton({
  children,
  onPress,
  disabled,
  active,
  appearance,
  label,
}: MeetingButtonProps) {
  const control = appearance === 'control' || appearance === 'controlDanger';
  const circle = appearance === 'circle' || appearance === 'danger' || appearance === 'icon';
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onPress}
      type={active ? 'primary' : 'default'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: appearance === 'plain' || appearance === 'row' || circle ? 0 : '4px 12px',
        width: control
          ? 48
          : circle
            ? 44
            : appearance === 'plain' || appearance === 'row'
              ? '100%'
              : undefined,
        height: control
          ? 46
          : circle
            ? 44
            : appearance === 'plain' || appearance === 'row'
              ? 'auto'
              : 40,
        borderRadius: appearance === 'row' ? 0 : control ? 14 : circle ? '50%' : 14,
        background:
          appearance === 'icon' || appearance === 'row'
            ? 'transparent'
            : appearance === 'danger' || appearance === 'controlDanger'
              ? '#24171A'
              : active
                ? circle || control
                  ? '#153B46'
                  : '#22CCEE'
                : '#1A2832',
        borderWidth: appearance === 'icon' || appearance === 'row' ? 0 : 1,
        boxShadow: 'none',
        borderColor:
          appearance === 'danger' || appearance === 'controlDanger' || appearance === 'destructive'
            ? '#FF4D4F'
            : active
              ? '#22CCEE'
              : '#FFFFFF16',
        color: disabled ? '#66707A' : '#E7EDF5',
      }}
    >
      {children}
    </Button>
  );
}
export function MeetingInput({
  value,
  onChangeText,
  placeholder,
  disabled,
  maxLength,
  onSubmit,
}: MeetingInputProps) {
  return (
    <Input.TextArea
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChangeText(event.target.value)}
      disabled={disabled}
      maxLength={maxLength}
      autoSize={{ minRows: 1, maxRows: 4 }}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing &&
          event.keyCode !== 229
        ) {
          event.preventDefault();
          onSubmit();
        }
      }}
      style={{
        background: '#1A222C',
        border: 0,
        color: '#E7EDF5',
        minHeight: 42,
        padding: '10px 12px',
        borderRadius: 10,
      }}
    />
  );
}

/** Settings use a single-line input; chat keeps the multiline/IME adapter above. */
export function MeetingSettingsInput({
  value,
  onChangeText,
  placeholder,
  disabled,
  maxLength,
  onSubmit,
  focus,
  secure,
  multiline,
}: MeetingInputProps) {
  const ref = useRef<InputRef>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  const Control = secure ? Input.Password : multiline ? Input.TextArea : Input;
  return (
    <Control
      ref={ref}
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      maxLength={maxLength}
      onChange={(event) => onChangeText(event.target.value)}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          !event.nativeEvent.isComposing &&
          event.keyCode !== 229 &&
          !multiline &&
          !disabled
        ) {
          event.preventDefault();
          onSubmit();
        }
      }}
      style={{
        background: '#1A222C',
        color: '#E7EDF5',
        borderColor: '#FFFFFF16',
        minHeight: 42,
        borderRadius: 10,
      }}
    />
  );
}
