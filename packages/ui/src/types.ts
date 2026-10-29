import type { ReactNode } from 'react';

/** Platform adapters wrap Ant Design without exposing platform event types. */
export interface MeetingButtonProps {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  appearance?:
    | 'primary'
    | 'circle'
    | 'danger'
    | 'plain'
    | 'icon'
    | 'destructive'
    | 'option'
    | 'control'
    | 'controlDanger'
    | 'row'
    | 'memberAction'
    | 'memberDanger';
  label?: string;
}
export type MeetingIconName =
  | 'microphone'
  | 'camera'
  | 'screen'
  | 'chat'
  | 'more'
  | 'leave'
  | 'copy'
  | 'link'
  | 'members'
  | 'close'
  | 'send'
  | 'host'
  | 'hand'
  | 'settings'
  | 'file'
  | 'back'
  | 'menu'
  | 'fullscreen'
  | 'fullscreenExit'
  | 'unfocus'
  | 'focus'
  | 'app'
  | 'avatar'
  | 'userAdd'
  | 'room'
  | 'space'
  | 'block'
  | 'flag';
export interface MeetingIconProps {
  name: MeetingIconName;
  size?: number;
  color?: string;
}
export interface MeetingInputProps {
  secure?: boolean;
  multiline?: boolean;
  focus?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  maxLength?: number;
  onSubmit: () => void;
}
