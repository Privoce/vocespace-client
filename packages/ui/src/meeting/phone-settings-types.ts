import type { ComponentType, ReactNode } from 'react';

export interface PhoneSettingsPanel {
  id: string;
  /** Platform adapter supplies the existing icon + text presentation. */
  label: ReactNode;
}
export interface PhoneSettingsParts {
  Menu: ComponentType<{ children: ReactNode }>;
  Profile: ComponentType<{ name: string; spaceName: string }>;
  Group: ComponentType<{ children: ReactNode }>;
  Row: ComponentType<{ children: ReactNode; onPress: () => void; nextIcon?: ReactNode }>;
  Header: ComponentType<{
    title: ReactNode;
    backLabel: string;
    onBack: () => void;
    backIcon?: ReactNode;
  }>;
}
export interface PhoneSettingsNavigationProps {
  name: string;
  spaceName: string;
  panels: readonly PhoneSettingsPanel[];
  groupLabels?: string[];
  hideHeader?: boolean;
  hostLabel?: string;
  onlineLabel?: string;
  activePanel?: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  backLabel: string;
  parts?: PhoneSettingsParts;
  nextIcon?: ReactNode;
  backIcon?: ReactNode;
}
