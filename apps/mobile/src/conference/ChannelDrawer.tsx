import { useState, type ReactNode } from 'react';
import { MeetingAvo } from '../ui/MeetingAvo';
import { channelContent } from '@vocespace/ui';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeRoomDirectory } from '@vocespace/contracts';
import { useI18n } from '../i18n';
import { PrimaryButton } from '../ui/controls';
import { MeetingIcon } from '../ui/meeting';

export function ChannelDrawer({
  directory,
  space,
  onJoin,
  busy,
  active = true,
  renderMedia,
}: {
  directory?: NativeRoomDirectory;
  space: string;
  onJoin: (name: string) => Promise<void>;
  busy: boolean;
  active?: boolean;
  renderMedia?: (id: string) => ReactNode;
}) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const row = (room: NonNullable<NativeRoomDirectory>['rooms'][number], main = false) => (
    <View
      key={room.name}
      style={{ padding: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#333' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MeetingIcon name={main ? 'space' : 'room'} size={16} color="#aaa" />
        <Pressable
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed.includes(room.name) }}
          onPress={() =>
            setCollapsed((old) =>
              old.includes(room.name)
                ? old.filter((name) => name !== room.name)
                : [...old, room.name],
            )
          }
        >
          <Text style={{ color: directory?.current === room.name ? '#22CCEE' : '#eee' }}>
            {main ? t('channel.menu.main') : room.name}
          </Text>
        </Pressable>
        <Text style={{ color: '#aaa' }}>{room.participantIds.length}</Text>
        <PrimaryButton
          size="small"
          type="ghost"
          disabled={busy || directory?.current === room.name}
          onPress={() => {
            void onJoin(room.name);
          }}
        >
          {t('channel.menu.join')}
        </PrimaryButton>
      </View>
      {!collapsed.includes(room.name) && !!room.participantIds.length && (
        <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
          {room.participantIds.map((id) => (
            <View
              key={id}
              style={{
                width: 110,
                height: 120,
                backgroundColor: '#282828',
                borderRadius: 6,
                overflow: 'hidden',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '100%',
                  height: 92,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {(active && renderMedia?.(id)) || (
                  <MeetingAvo avo={directory?.participants?.[id]?.avo} animate={active} />
                )}
              </View>
              <Text numberOfLines={1} style={{ color: '#eee', fontSize: 11, paddingHorizontal: 4 }}>
                {directory?.participants?.[id]?.name || id}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
  const main = directory?.rooms.find((room) => room.name === space);
  return (
    <ScrollView style={{ backgroundColor: '#1e1e1e' }}>
      {channelContent({
        main: main ? row(main, true) : null,
        rooms: (
          <>
            <View style={{ padding: 12, flexDirection: 'row', gap: 8 }}>
              <MeetingIcon name="room" size={16} />
              <Text style={{ color: '#eee' }}>{t('channel.menu.sub')}</Text>
            </View>
            {directory?.rooms.filter((room) => room.name !== space).map((room) => row(room))}
          </>
        ),
      })}
    </ScrollView>
  );
}
