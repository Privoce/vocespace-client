import type { ComponentType, ReactNode } from 'react';
import type { MeetingTile } from '@vocespace/meeting-core';
import type { MeetingButtonProps, MeetingIconProps, MeetingInputProps } from '../types';

export interface MeetingLabels {
  previous: string;
  next: string;
  focus: string;
  unfocus: string;
  cameraOff: string;
  empty: string;
  chat: string;
  close: string;
}
export interface MeetingAction {
  id: string;
  label: string;
  icon: MeetingIconProps['name'];
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  muted?: boolean;
  badge?: number;
  description?: string;
  menu?: ReactNode;
  content?: ReactNode;
}
export interface MeetingPrimitives {
  Button: ComponentType<MeetingButtonProps>;
  Icon: ComponentType<MeetingIconProps>;
}
export interface MeetingPanel {
  variant?: 'settings' | 'drawer';
  title: string;
  open: boolean;
  onClose: () => void;
  content: ReactNode;
}
export interface PhoneMeetingProps {
  name: string;
  status: string;
  connected?: boolean;
  avoidKeyboard?: boolean;
  focusedExtraTile?: string;
  onFocusTrack?: () => void;
  tiles: readonly MeetingTile[];
  labels: MeetingLabels;
  Button: ComponentType<MeetingButtonProps>;
  Icon?: ComponentType<MeetingIconProps>;
  leadingAction?: MeetingAction;
  headerActions?: MeetingAction[];
  renderAvatar?: (item: MeetingTile) => ReactNode;
  renderTileActions?: (item: MeetingTile, focused: boolean, toggleFocus: () => void) => ReactNode;
  onFocusedChange?: (focused: boolean) => void;
  renderVideo: (id: string) => ReactNode;
  /** Existing Web widgets keep their lifecycle and capabilities in an adapter. */
  extraTiles?: { id: string; content: ReactNode }[];
  controls: ReactNode;
  notice?: ReactNode;
  chat?: { open: boolean; onClose: () => void; content: ReactNode };
  panel?: MeetingPanel;
}
export interface MeetingControlsProps extends MeetingPrimitives {
  actions: MeetingAction[];
}
export interface MeetingMembersProps extends MeetingPrimitives {
  members: readonly MeetingTile[];
  Input?: ComponentType<MeetingInputProps>;
  searchLabel?: string;
  hostLabel?: string;
  managerLabel?: string;
  inviteLabel?: string;
  onInvite?: () => void;
}
export interface MeetingMenuProps extends MeetingPrimitives {
  actions: MeetingAction[];
}
export interface MeetingChatMessage {
  id: string;
  name: string;
  text: string;
  local: boolean;
  attachment?: ReactNode;
}
export interface MeetingChatProps extends MeetingPrimitives {
  Input: ComponentType<MeetingInputProps>;
  messages: readonly MeetingChatMessage[];
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  maxLength: number;
  placeholder: string;
  sendLabel: string;
  emptyLabel: string;
  status?: string;
  error?: string;
  tools?: ReactNode;
}
