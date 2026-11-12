import { useState } from 'react';
import type { MeetingToolFolderProps } from './types';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/** A measured app folder: full touch targets when they fit, a single folder otherwise. */
export function MeetingToolFolder({ items, label, closeLabel }: MeetingToolFolderProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [open, setOpen] = useState(false);
  const columns = Math.max(1, Math.floor((size.width - 26) / 64));
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const fits = size.width >= 90 && size.height >= rows * 64 + 26;
  const grid = (expanded: boolean) => (
    <View style={[s.grid, !expanded && s.inlineGrid]}>
      {items.map((item) => (
        <View key={item.id} style={[s.item, { width: expanded ? 72 : `${100 / columns}%` }]}>
          {typeof item.content === 'function' ? item.content(() => setOpen(false)) : item.content}
        </View>
      ))}
    </View>
  );
  return (
    <View style={s.root} onLayout={(event) => setSize(event.nativeEvent.layout)}>
      {fits ? (
        grid(false)
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => setOpen(true)}
          style={s.folder}
        >
          <View pointerEvents="none" style={s.previewGrid}>
            {items.map((item) => (
              <View
                key={item.id}
                style={[s.previewItem, { width: `${100 / columns}%`, height: `${100 / rows}%` }]}
              >
                {item.icon}
              </View>
            ))}
          </View>
        </Pressable>
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityLabel={closeLabel}
          />
          <View style={s.dialog}>
            <View style={s.header}>
              <Text style={s.title}>{label}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                onPress={() => setOpen(false)}
                style={s.close}
              >
                <Text style={s.title}>×</Text>
              </Pressable>
            </View>
            <ScrollView>{grid(true)}</ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#565656',
    borderRadius: 16,
    backgroundColor: '#202020',
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 12,
    width: '100%',
  },
  inlineGrid: { flex: 1, alignContent: 'space-around' },
  item: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  folder: { flex: 1, width: '100%', padding: 12 },
  previewGrid: { flex: 1, width: '100%', flexDirection: 'row', flexWrap: 'wrap' },
  previewItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0009',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#202020',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#eee', fontSize: 18 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
