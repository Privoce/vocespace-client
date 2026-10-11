import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

export function MeetingToolbar({ children }: { children: ReactNode }) {
  return <View style={styles.toolbar}>{children}</View>;
}
const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    backgroundColor: '#1E1E1E',
  },
});
