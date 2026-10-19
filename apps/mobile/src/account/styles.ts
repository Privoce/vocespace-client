import { StyleSheet } from 'react-native';
import { colors } from '../theme';
export const accountColors = {
  background: '#191919',
  panel: '#242424',
  text: '#E5E7EB',
  muted: '#999999',
  line: '#333333',
  accent: colors.accent,
};
export const accountStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: accountColors.background },
  page: { flexGrow: 1, padding: 16, gap: 16, paddingBottom: 28 },
  text: { color: accountColors.text, fontSize: 16 },
  muted: { color: accountColors.muted, fontSize: 13, lineHeight: 20 },
  title: { color: accountColors.text, fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panel: {
    backgroundColor: accountColors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: accountColors.line,
    padding: 16,
    gap: 14,
  },
  line: { height: 1, backgroundColor: accountColors.line, flex: 1 },
  link: { color: accountColors.accent, fontSize: 13 },
  button: { borderRadius: 4, minHeight: 42 },
  outlined: { borderColor: '#22CCEE88', borderRadius: 4 },
});
