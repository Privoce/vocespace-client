import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { NativeSpaceSummary } from '@vocespace/contracts';
import type { AccountModel } from '../../account/hooks/useAccount';
import { IconOutline, PrimaryButton } from '../../ui/controls';
import { useI18n } from '../../i18n';
import { useMySpaces } from './hooks/useMySpaces';
import { RoomIllustration } from './RoomIllustration';
import { meetingTabStyles as s, palette as c } from './styles';
export function MySpaces({
  account,
  active,
  spaces,
  disabled,
  onJoin,
  error,
}: {
  account: AccountModel;
  active: boolean;
  spaces: NativeSpaceSummary[];
  disabled: boolean;
  onJoin: (name: string, create: boolean) => void;
  error?: string;
}) {
  const { t } = useI18n();
  const text = (key: string) => t(`meeting_tab.${key}`);
  const my = useMySpaces(account, active);
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.page}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={my.loading} onRefresh={my.refresh} tintColor={c.accent} />
      }
    >
      <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 4 }]}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={s.eyebrow}>MAKE ROOM FOR YOUR PEOPLE</Text>
          <Text style={s.title}>
            {text('headline')}
            <Text style={{ color: c.accent }}>。</Text>
          </Text>
          <Text style={s.body}>{text('subtitle')}</Text>
        </View>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 23,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: '-8deg' }],
          }}
        >
          <IconOutline name="team" size={36} color="#67BBCB" />
          <View
            style={{
              position: 'absolute',
              right: -7,
              top: -6,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: c.accent,
            }}
          />
        </View>
      </View>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <View style={s.row}>
          <Text style={s.section}>{text('rooms')}</Text>
          <Text style={s.count}>{String(my.rooms.length).padStart(2, '0')}</Text>
        </View>
        <Text style={[s.body, { fontSize: 9 }]}>{text('reserved')}</Text>
      </View>
      <View style={{ gap: 10 }}>
        {!account.signedIn && (
          <View style={{ gap: 12 }}>
            <Text style={s.body}>{text('sign_in_hint')}</Text>
            <PrimaryButton type="ghost" onPress={() => account.open('login')}>
              {t('native_account.login')}
            </PrimaryButton>
          </View>
        )}
        {my.loading && !my.rooms.length && <ActivityIndicator color={c.accent} />}
        {my.error && (
          <Pressable onPress={my.refresh} accessibilityRole="button" style={{ minHeight: 44 }}>
            <Text style={s.body}>{text('rooms_error')}</Text>
          </Pressable>
        )}
        {account.signedIn && !my.loading && !my.error && !my.rooms.length && (
          <Text style={s.body}>{text('empty')}</Text>
        )}
        {my.rooms.map((room) => {
          const live = spaces.find((space) => space.name === room.spaceName);
          return (
            <View key={room.id} style={s.room}>
              <View style={s.roomIcon}>
                <IconOutline
                  name={room.kind === 'class' ? 'read' : 'team'}
                  size={24}
                  color={c.green}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>
                  {room.name}
                </Text>
                <Text style={[s.body, { fontSize: 10 }]}>
                  {live ? `${live.participantCount} ${text('online')}` : text('waiting')}
                  {room.spaceName === account.profile.username ? `  ·  ${text('primary')}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${text('enter')} ${room.name}`}
                disabled={disabled || !room.spaceName}
                style={[s.enter, (disabled || !room.spaceName) && { opacity: 0.4 }]}
                onPress={() =>
                  room.spaceName &&
                  onJoin(room.spaceName, room.spaceName === account.profile.username)
                }
              >
                <Text style={s.enterText}>{text('enter')}</Text>
                <IconOutline name="arrow-right" size={13} color="#73DDEE" />
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={s.divider} />
      <View style={{ gap: 8 }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={s.section}>{text('create_heading')}</Text>
          <Text style={[s.eyebrow, { fontSize: 6 }]}>CREATE A SPACE</Text>
        </View>
        <Text style={s.body}>{text('choose')}</Text>
      </View>
      <View style={[s.row, { alignItems: 'stretch', gap: 8 }]}>
        {(['meeting', 'watch', 'class'] as const).map((kind) => (
          <View
            key={kind}
            style={[s.typeCard, kind === 'meeting' && s.selected]}
            accessibilityLabel={`${text(kind)}${kind !== 'meeting' ? ` · ${text('soon')}` : ''}`}
          >
            <View style={s.radio}>
              <IconOutline
                name={kind === 'meeting' ? 'check-circle' : 'clock-circle'}
                size={14}
                color={kind === 'meeting' ? c.accent : c.muted}
              />
            </View>
            <View style={{ width: '100%', alignItems: 'center' }}>
              <RoomIllustration kind={kind} size={78} />
            </View>
            <Text style={s.typeName}>{text(kind)}</Text>
            <Text style={s.typeCaption}>{kind === 'meeting' ? 'JUST TALK' : text('soon')}</Text>
          </View>
        ))}
      </View>
      <Text style={s.center}>• {text('create_hint')}</Text>
      {error && (
        <Text accessibilityRole="alert" style={{ color: '#FF8996' }}>
          {error}
        </Text>
      )}
      <PrimaryButton
        disabled={disabled}
        style={s.create}
        onPress={() => {
          const id = Crypto.randomUUID().replace(/-/g, '');
          onJoin(`${id.slice(0, 4)}-${id.slice(4, 8)}`, true);
        }}
      >
        <View style={[s.row, { width: '100%', justifyContent: 'space-between' }]}>
          <IconOutline name="plus" size={20} color="#12303A" />
          <Text style={{ color: '#12303A', fontWeight: '600' }}>{text('create')}</Text>
          <IconOutline name="arrow-right" size={18} color="#12303A" />
        </View>
      </PrimaryButton>
      <Text style={s.center}>{text('footer')}</Text>
    </ScrollView>
  );
}
