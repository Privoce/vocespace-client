import { Flex, Typography } from 'antd';
import type { SettingsElements } from '@vocespace/ui';
/** Existing HTML + SCSS remain authoritative. These ports do not add DOM wrappers. */
export const settingsElements: SettingsElements = {
  Heading4: 'h4',
  Clickable: 'div',
  Article: 'article',
  Bold: 'strong',
  Break: 'br',
  Div: 'div',
  Span: 'span',
  Link: 'a',
  Strong: Typography.Text,
  Flex,
};
