import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { participantColor } from '@vocespace/meeting-core';
import { participantRowContent } from '../content';
import type { MeetingMembersProps } from './types';
export function MeetingMembers({
  members,
  Icon,
  Button,
  Input,
  searchLabel = '',
  hostLabel = '',
  managerLabel = '',
  inviteLabel = '',
  onInvite,
}: MeetingMembersProps) {
  const [search, setSearch] = useState('');
  return (
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      {(Input || onInvite) && (
        <View style={styles.header}>
          {Input && (
            <View style={{ flex: 1 }}>
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder={searchLabel}
                onSubmit={() => {}}
              />
            </View>
          )}
          {onInvite && (
            <Button onPress={onInvite} label={inviteLabel}>
              <Icon name="userAdd" size={16} />
            </Button>
          )}
        </View>
      )}
      {members
        .filter((m) => m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
        .map((member) => (
          <View key={member.id}>
            {participantRowContent({
              row: (children) => <View style={styles.member}>{children}</View>,
              identity: (children) => <View style={styles.identity}>{children}</View>,
              avatar: (
                <View style={[styles.avatar, { backgroundColor: participantColor(member.name) }]}>
                  <Text style={{ color: '#fff' }}>{member.name.substring(0, 3)}</Text>
                </View>
              ),
              name: (
                <Text numberOfLines={1} style={styles.name}>
                  {member.name}
                </Text>
              ),
              roles: (
                <>
                  {member.owner && <Text style={styles.role}>( {hostLabel} )</Text>}
                  {member.manager && <Text style={styles.role}>( {managerLabel} )</Text>}
                </>
              ),
              suffix: (
                <View style={styles.header}>
                  {(['microphone', 'camera'] as const).map((name) => (
                    <View key={name}>
                      <Icon name={name} size={18} color="#ccc" />
                      {!(name === 'camera' ? member.video : member.microphone) && (
                        <View style={styles.slash} />
                      )}
                    </View>
                  ))}
                </View>
              ),
            })}
          </View>
        ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  list: { paddingHorizontal: 24, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  member: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#eee', fontSize: 14, flexShrink: 1 },
  role: { color: '#aaa', fontSize: 12 },
  slash: {
    position: 'absolute',
    width: 20,
    height: 1,
    backgroundColor: '#ccc',
    top: 9,
    transform: [{ rotate: '45deg' }],
  },
});
