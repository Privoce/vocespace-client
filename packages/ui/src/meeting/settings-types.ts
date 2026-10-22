import type { ReactNode, ComponentType } from 'react';
import type { MeetingButtonProps, MeetingIconProps, MeetingInputProps } from '../types';

interface FieldBase {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}
export type MeetingSettingField = FieldBase &
  (
    | { kind: 'value'; value: string }
    | { kind: 'content'; content: ReactNode }
    | { kind: 'action'; onPress: () => void; destructive?: boolean }
    | {
        kind: 'input';
        value: string;
        onChange: (value: string) => void;
        placeholder?: string;
        secure?: boolean;
        multiline?: boolean;
      }
    | {
        kind: 'range';
        value: number;
        min: number;
        max: number;
        step: number;
        onChange: (value: number) => void;
      }
    | {
        kind: 'gallery';
        value: string;
        options: readonly {
          value: string;
          label: string;
          preview?: ReactNode;
          color?: string;
          imageUri?: string;
        }[];
        onChange: (value: string) => void;
      }
    | {
        kind: 'choice';
        value: string;
        options: readonly { value: string; label: string; disabled?: boolean }[];
        onChange: (value: string) => void;
      }
    | {
        kind: 'toggle';
        value: boolean;
        onChange: (value: boolean) => void;
        onLabel: string;
        offLabel: string;
      }
    | {
        kind: 'text';
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
        saveLabel: string;
        onSave: () => void;
        focus?: boolean;
        maxLength?: number;
      }
  );
export interface MeetingSettingsFormProps {
  variant?: 'web-phone';
  fields: readonly MeetingSettingField[];
  Button: ComponentType<MeetingButtonProps>;
  Input: ComponentType<MeetingInputProps>;
  Range?: ComponentType<MeetingSettingsRangeProps>;
}
export interface MeetingSettingsPanel {
  id: string;
  label: string;
  group: string;
}
export interface MeetingSettingsNavigationProps {
  name: string;
  spaceName: string;
  panels: readonly MeetingSettingsPanel[];
  activePanel?: string;
  selectedPanel?: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  backLabel: string;
  Button: ComponentType<MeetingButtonProps>;
  Icon: ComponentType<MeetingIconProps>;
}

export interface MeetingSettingsRangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}
export const meetingSettingsSections = [
  { id: 'general', icon: 'setting', group: 'general', labelKey: 'settings.general.title' },
  { id: 'profile', icon: 'smile', group: 'general', labelKey: 'settings.profile.title' },
  { id: 'auth', icon: 'auth', group: 'general', labelKey: 'settings.auth.title' },
  { id: 'ai', icon: 'ai', group: 'media', labelKey: 'settings.ai.title' },
  { id: 'audio', icon: 'audio', group: 'media', labelKey: 'settings.audio.title' },
  { id: 'video', icon: 'video', group: 'media', labelKey: 'settings.video.title' },
  { id: 'app', icon: 'app', group: 'media', labelKey: 'more.app.title' },
  { id: 'recording', icon: 'record', group: 'service', labelKey: 'recording.title' },
  { id: 'license', icon: 'license', group: 'service', labelKey: 'settings.license.title' },
  { id: 'about_us', icon: 'logo', group: 'service', labelKey: 'settings.about_us.title' },
] as const;
