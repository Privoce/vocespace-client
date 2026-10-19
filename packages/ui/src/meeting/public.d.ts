import type { ReactElement } from 'react';
import type {
  PhoneMeetingProps,
  MeetingControlsProps,
  MeetingMenuProps,
  MeetingChatProps,
  MeetingMembersProps,
} from './types';
export type * from './types';
export type { MeetingTile } from '@vocespace/meeting-core';
export declare function PhoneMeeting(props: PhoneMeetingProps): ReactElement;
export declare function MeetingControls(props: MeetingControlsProps): ReactElement;
export declare function MeetingMenu(props: MeetingMenuProps): ReactElement;
export declare function MeetingChat(props: MeetingChatProps): ReactElement;
export declare function MeetingMembers(props: MeetingMembersProps): ReactElement;

import type { MeetingSettingsFormProps, MeetingSettingsNavigationProps } from './settings-types';
export type * from './settings-types';
export declare function MeetingSettingsForm(props: MeetingSettingsFormProps): ReactElement;
export declare function MeetingSettingsNavigation(
  props: MeetingSettingsNavigationProps,
): ReactElement;

export { meetingSettingsSections } from './settings-types';

import type { PhoneSettingsNavigationProps } from './phone-settings-types';
export type * from './phone-settings-types';
export declare function PhoneSettingsNavigation(props: PhoneSettingsNavigationProps): ReactElement;
export * from './settings/content';
export type { SettingsElements, SettingsViewProps, SettingsSlots } from './settings/types';

export * from './settings/advanced';
export {
  avoStyles,
  avoPalette,
  virtualModels,
  virtualBackgrounds,
  licenseDetailKeys,
} from '@vocespace/meeting-core';

import type {
  MeetingSheetProps,
  MeetingShareProps,
  MeetingDockProps,
  MeetingTileActionsProps,
} from './types';
export declare function MeetingSheet(props: MeetingSheetProps): ReactElement;
export declare function MeetingShare(props: MeetingShareProps): ReactElement;
export declare function MeetingDock(props: MeetingDockProps): ReactElement;
export declare function MeetingTileActions(props: MeetingTileActionsProps): ReactElement;
export declare function InitialAvatar(props: { name: string; size?: number }): ReactElement;

export declare function MeetingSheetHeader(
  props: Pick<
    MeetingSheetProps,
    'title' | 'subtitle' | 'onClose' | 'onBack' | 'Button' | 'Icon' | 'closeLabel' | 'backLabel'
  >,
): ReactElement;
