import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { InitialAvatar } from './InitialAvatar';
import type { MemberActionsProps } from './types';

/** Member-list avatar; platform adapters own sheets, confirmation and network calls. */
export function MemberActions({ name, status, canBlock, busy, t, Button, Icon, onBlock, onReport }: MemberActionsProps) {
  return <ScrollView contentContainerStyle={s.root}>
    <InitialAvatar name={name} size={76} />
    <Text style={s.name}>{name}</Text>
    <Text style={s.status}>{status || t('phone_meeting.online')}</Text>
    <View style={s.actions}>
      {canBlock && <View style={s.action}><Button appearance="memberDanger" disabled={busy} onPress={onBlock}>
        <View style={s.card}><Icon name="block" size={26} color="#FF8195" /><Text style={s.block}>{t('moderation.block')}</Text></View>
      </Button></View>}
      <View style={s.action}><Button appearance="memberAction" disabled={busy} onPress={onReport}>
        <View style={s.card}><Icon name="flag" size={26} color="#9AB5C4" /><Text style={s.status}>{t('moderation.report.title')}</Text></View>
      </Button></View>
    </View>
  </ScrollView>;
}
const s = StyleSheet.create({
  root: { padding: 24, alignItems: 'center', gap: 12 },
  name: { color: '#E7EDF5', fontSize: 18, fontWeight: '600' },
  status: { color: '#9AB5C4', fontSize: 15 },
  block: { color: '#FF8195', fontSize: 17 },
  actions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 12 },
  action: { flex: 1 },
  card: { gap: 14, alignItems: 'center', justifyContent: 'center' },
});
