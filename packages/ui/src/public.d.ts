import type { ReactElement, ReactNode } from 'react';
export type {
  MeetingButtonProps,
  MeetingIconProps,
  MeetingIconName,
  MeetingInputProps,
} from './types';
export declare function MeetingToolbar(props: { children: ReactNode }): ReactElement;
export declare const meetingColors: {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
};

export { settingsIcons, settingsVector } from './settings-icons';
export type { SettingsIconName, SettingsVectorNode } from './settings-icons';

export * from './meeting/public';

export * from './content';

export { meetingVector, type MeetingVectorName } from './meeting-icons';

export { Creature, participantColor, normalizeAvo } from '@vocespace/meeting-core';
export type { AvoParams, AvoDrawing } from '@vocespace/meeting-core';

export * from './svg-resource';
