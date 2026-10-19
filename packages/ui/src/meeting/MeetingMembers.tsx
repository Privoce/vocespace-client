import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { InitialAvatar } from './InitialAvatar';
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
  selfLabel,
  speakingLabel,
  onlineLabel,
  onInvite,
  compact,
  renderActions,
}: MeetingMembersProps) {
  const [search, setSearch] = useState('');
  return (
    <ScrollView
      contentContainerStyle={[s.list, compact && { padding: 0 }]}
      keyboardShouldPersistTaps="handled"
    >
      {Input && members.length > 6 && (
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder={searchLabel}
          onSubmit={() => {}}
        />
      )}
      {members
        .filter((m) => m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
        .map((member) => (
          <View key={member.id} style={s.member}>
            <InitialAvatar name={member.name} size={compact ? 32 : 44} />
            <View style={s.identity}>
              <Text numberOfLines={1} style={s.name}>
                {member.name}
              </Text>
              <Text style={[s.status, member.speaking && { color: '#22CCEE' }]}>
                {[
                  member.local && selfLabel,
                  member.owner ? hostLabel : member.manager ? managerLabel : undefined,
                  member.speaking ? speakingLabel : member.status || onlineLabel,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <View>
              <Icon name="microphone" size={20} color={member.speaking ? '#22CCEE' : '#7894A5'} />
              {!member.microphone && <View style={s.slash} />}
            </View>
            {renderActions?.(member)}
          </View>
        ))}
      {!compact && onInvite && (
        <View style={s.invite}>
          <Button appearance="plain" onPress={onInvite} label={inviteLabel}>
            <View style={s.inviteContent}>
              <Icon name="link" />
              <Text style={s.name}>{inviteLabel}</Text>
            </View>
          </Button>
        </View>
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  list: { paddingHorizontal: 22, paddingVertical: 18 },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: '#2A3E4B',
  },
  identity: { flex: 1, minWidth: 0, gap: 6 },
  name: { color: '#E7EDF5', fontSize: 14, fontWeight: '500' },
  status: { color: '#829EAE', fontSize: 12 },
  slash: {
    position: 'absolute',
    width: 22,
    height: 1,
    backgroundColor: '#7894A5',
    top: 10,
    transform: [{ rotate: '45deg' }],
  },
  invite: { marginTop: 20 },
  inviteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 10,
  },
});
