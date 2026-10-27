'use client';
import { createElement, type ReactElement } from 'react';
import { meetingIconSource, meetingButtonVisual, type SvgResourceNode } from '@vocespace/ui';
import { Button, Input, type InputRef } from 'antd';
import { useEffect, useRef } from 'react';

import type { MeetingButtonProps, MeetingIconProps, MeetingInputProps } from '@vocespace/ui';
export function MeetingIcon(props: MeetingIconProps) {
  const render = (node: SvgResourceNode, key = 0): ReactElement =>
    createElement(
      node.tag,
      { ...node.attrs, key },
      ...node.children.map((child, index) =>
        typeof child === 'string' ? child : render(child, index),
      ),
    );
  return render(meetingIconSource(props));
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
  const visual = meetingButtonVisual({ appearance, active, disabled });
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onPress}
      type={active || appearance === 'primary' ? 'primary' : 'default'}
      style={{
        padding: 0,
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
        ...visual,
        boxShadow: 'none',
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
        border: 0,
        color: '#E7EDF5',
        minHeight: 42,
        padding: '10px 12px',
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
        color: '#E7EDF5',
        borderColor: '#FFFFFF16',
        minHeight: multiline ? 120 : 42,
      }}
    />
  );
}
