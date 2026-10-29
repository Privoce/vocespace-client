import type { ComponentType, ReactNode } from 'react';
import type { MeetingTile } from '@vocespace/meeting-core';
import type { MeetingButtonProps, MeetingIconProps, MeetingInputProps } from '../types';

export interface MeetingLabels {
  grid?: string;
  focusLayout?: string;
  page?: string;
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
  backLabel?: string;
  variant?: 'settings' | 'drawer';
  subtitle?: string;
  onBack?: () => void;
  height?: `${number}%`;
  hideHeader?: boolean;
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
  fullscreenTileId?: string;
  onFocusTrack?: () => void;
  tiles: readonly MeetingTile[];
  labels: MeetingLabels;
  Button: ComponentType<MeetingButtonProps>;
  Icon?: ComponentType<MeetingIconProps>;
  leadingAction?: MeetingAction;
  headerActions?: MeetingAction[];
  onLowerHand?: (item: MeetingTile) => void;
  handLabel?: string;
  lowerHandLabel?: string;
  renderAvatar?: (item: MeetingTile, compact: boolean) => ReactNode;
  renderTileActions?: (item: MeetingTile, focused: boolean, toggleFocus: () => void) => ReactNode;
  onMemberLongPress?: (item: MeetingTile) => void;
  onFocusedChange?: (focused: boolean) => void;
  renderVideo: (id: string) => ReactNode;
  /** Existing Web widgets keep their lifecycle and capabilities in an adapter. */
  extraTiles?: { id: string; content: ReactNode }[];
  controls: ReactNode;
  dock?: ReactNode;
  renderSheet?: (props: MeetingSheetProps) => ReactNode;
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
  selfLabel?: string;
  speakingLabel?: string;
  onlineLabel?: string;
  compact?: boolean;
  renderActions?: (member: MeetingTile) => ReactNode;
}
export interface MeetingMenuProps extends MeetingPrimitives {
  footer?: string;
  actions: MeetingAction[];
}
export interface MeetingChatMessage {
  id: string;
  name: string;
  text: string;
  local: boolean;
  attachment?: ReactNode;
  time?: string;
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
  compact?: boolean;
  roomName?: string;
  roomSubtitle?: string;
}

export interface MeetingSheetProps extends MeetingPanel {
  Button: ComponentType<MeetingButtonProps>;
  Icon?: ComponentType<MeetingIconProps>;
  closeLabel: string;
  backLabel?: string;
}
export interface MeetingShareProps extends MeetingPrimitives {
  name: string;
  title: string;
  description: string;
  copyLabel: string;
  onCopy: () => void;
  extra?: ReactNode;
}
export interface MeetingDockProps extends MeetingPrimitives {
  chatLabel: string;
  membersLabel: string;
  expandLabel: string;
  count: number;
  unread?: number;
  chat: ReactNode;
  members: ReactNode;
  onExpand: (tab: 'chat' | 'members') => void;
}
export interface MeetingTileActionsProps extends MeetingPrimitives {
  actions: MeetingAction[];
}

export interface MeetingRaisedHandProps {
  raised?: boolean;
  label?: string;
  onLower?: () => void;
  disabled?: boolean;
  Icon: ComponentType<MeetingIconProps>;
}

export interface MeetingParticipantToolsProps extends MeetingPrimitives {
  focused: boolean;
  fullscreen?: boolean;
  onFocus: () => void;
  onFullscreen: () => void;
  onAvatar?: () => void;
  onApps?: () => void;
  labels: {
    focus: string;
    unfocus: string;
    fullscreen: string;
    exitFullscreen: string;
    avatar: string;
    apps: string;
  };
}

export interface MemberActionsProps {
  Icon: ComponentType<MeetingIconProps>;
  name: string;
  status?: string;
  canBlock: boolean;
  busy?: boolean;
  t: (key: string) => string;
  Button: ComponentType<MeetingButtonProps>;
  onBlock: () => void;
  onReport: () => void;
}
