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
  modal: string;
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

export { meetingIconSource, meetingIconSources } from './meeting-icon-source';
export { phoneButtonColors, meetingButtonVisual } from './button-theme';

export { legalDocuments } from './legal/documents';
export type { LegalDocumentId } from './legal/documents';
export { legalLink, legalAnchor } from './legal/markdown';
export declare function LegalDocumentContent(props: {
  documentId: import('./legal/documents').LegalDocumentId;
  onOpenLink: (href: string) => void;
  onSectionLayout?: (id: string, y: number) => void;
}): ReactElement;
