import { phoneButtonColors } from '@vocespace/ui';
import { StyleSheet } from 'react-native';
import type { Theme } from '@ant-design/react-native/lib/style';
import defaultTheme from '@ant-design/react-native/lib/style/themes/default';
import createTabBarStyles from '@ant-design/react-native/lib/tab-bar/style';

// Match apps/web/app/layout.tsx's ConfigProvider; keep platform-specific spacing here.
export const colors = {
  background: '#121212',
  surface: '#1E1E1E',
  text: '#FFFFFF',
  body: '#AAAAAA',
  muted: '#8C8C8C',
  disabled: '#333333',
  accent: phoneButtonColors.primary,
  active: phoneButtonColors.primaryPressed,
  onAccent: phoneButtonColors.primaryText,
  border: '#333333',
};
export const antdTheme: Partial<Theme> = {
  brand_primary: colors.accent,
  brand_primary_tap: colors.active,
  primary_button_fill: colors.accent,
  primary_button_fill_tap: colors.active,
  ghost_button_color: colors.accent,
  color_link: colors.accent,
  color_text_base: colors.body,
  color_text_placeholder: colors.muted,
  color_text_disabled: colors.disabled,
  color_text_caption: colors.muted,
  color_text_paragraph: colors.body,
  color_icon_base: colors.muted,
  fill_body: colors.background,
  fill_base: colors.surface,
  fill_tap: colors.border,
  fill_disabled: colors.disabled,
  border_color_base: colors.border,
  tab_bar_fill: colors.surface,
  tab_bar_height: 60,
  switch_unchecked: colors.border,
  radius_xs: 4,
  radius_sm: 4,
  radius_md: 4,
  radius_lg: 4,
};
export const primaryButtonStyles = {
  primaryRawText: { color: colors.onAccent },
  primaryHighlightText: { color: colors.onAccent },
  primaryDisabledRawText: { color: colors.onAccent },
};
const baseTabBarStyles = createTabBarStyles({ ...defaultTheme, ...antdTheme });
export const tabBarStyles = {
  ...baseTabBarStyles,
  contentItem: { ...baseTabBarStyles.contentItem, backgroundColor: colors.background },
};
export const ui = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, gap: 24 },
  eyebrow: { color: colors.accent, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 20, fontWeight: '600' },
  body: { color: colors.body, fontSize: 15, lineHeight: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 24, gap: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputText: { color: colors.text, fontSize: 14 },
});
