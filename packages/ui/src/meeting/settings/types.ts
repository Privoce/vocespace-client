import type { CSSProperties, ElementType, ReactNode } from 'react';

/** DOM on Web, RN primitives on App. Only presentation travels through these ports. */
export interface SettingsElements {
  Heading4: ElementType<{ children?: ReactNode }>;
  Clickable: ElementType<{
    children?: ReactNode;
    className?: string;
    onClick?: () => void;
    role?: 'button';
    tabIndex?: number;
    'aria-expanded'?: boolean;
    onKeyDown?: (event: { key: string; preventDefault: () => void }) => void;
  }>;
  Article: ElementType<{ children?: ReactNode; className?: string }>;
  Bold: ElementType<{ children?: ReactNode }>;
  Break: ElementType;
  Strong: ElementType<{ children?: ReactNode; strong?: boolean; style?: CSSProperties }>;
  Flex: ElementType<{
    children?: ReactNode;
    justify?: 'space-between';
    align?: 'center';
    style?: CSSProperties;
  }>;
  Div: ElementType<{ children?: ReactNode; className?: string; style?: CSSProperties }>;
  Span: ElementType<{ children?: ReactNode; style?: CSSProperties }>;
  Link: ElementType<{ children?: ReactNode; href: string; style?: CSSProperties }>;
}
export interface SettingsViewProps {
  elements: SettingsElements;
  styles: Record<string, string>;
  t: (key: string) => string;
}
export type SettingsSlots<K extends string> = Record<K, ReactNode>;
