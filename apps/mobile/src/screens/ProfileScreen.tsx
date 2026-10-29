import { useAnalyticsPage } from '../analytics/hooks/useAnalyticsPage';
import { AccountAvatar } from '../account/AccountAvatar';
import { FeedbackPage } from '../feedback/FeedbackPage';
import type { FeedbackSend } from '../feedback/client';
import { ProfilePage } from '../account/ProfilePage';
import { AboutContent } from '../ui/AboutContent';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { useLocalSettings } from '../settings/hooks/useLocalSettings';
import type { AccountModel } from '../account/hooks/useAccount';
import { useProfileScreen } from '../account/hooks/useProfileScreen';
import { accountColors as c, accountStyles as s } from '../account/styles';
import { useI18n } from '../i18n';
import { IconOutline, Input, PrimaryButton, Switch } from '../ui/controls';
import { SettingsDialog } from '../ui/settings-widgets';
import { LanguageSelect } from '../ui/LanguageSelect';
type IconName = ComponentProps<typeof IconOutline>['name'];
export function ProfileScreen({
  active = true,
  model,
  account,
  onBrowse,
  onJoin,
  onLogout,
  onDelete,
  joining,
  sendFeedback,
}: {
  active?: boolean;
  model: ReturnType<typeof useLocalSettings>;
  account: AccountModel;
  onBrowse: () => void;
  onJoin: (space: string) => void;
  onLogout: () => Promise<void>;
  onDelete: (password: string) => Promise<boolean>;
  joining: boolean;
  sendFeedback: FeedbackSend;
}) {
  const { t, error: languageError } = useI18n();
  const text = (key: string) => t(`native_account.${key}`);
  const m = useProfileScreen(account);
  useAnalyticsPage(m.panel === 'feedback' ? 'feedback' : m.panel === 'about' ? 'about' : 'profile', active, 2);
  const signedIn = account.signedIn;
  /* 我的内容尚未接入，保留布局供后续恢复。
  const library = (
    <>
      <Row
        icon="history"
        title={text('history')}
        detail={text('history_detail')}
        onPress={() => m.notice('history')}
      />
      <Row
        icon="heart"
        title={text('my_following')}
        detail={text('following_detail')}
        onPress={() => m.notice('following')}
      />
      <Row
        icon="play-circle"
        title={text('recordings')}
        detail={text('recordings_detail')}
        onPress={() => m.notice('recordings')}
        last
      />
    </>
  );
  */
  if (m.panel === 'feedback')
    return (
      <FeedbackPage
        accountEmail={signedIn ? account.profile.email : undefined}
        send={sendFeedback}
        onBack={() => m.setPanel(undefined)}
      />
    );
  if (m.panel === 'about')
    return (
      <ProfilePage title={text('about')} onBack={() => m.setPanel(undefined)}>
        <AboutContent fullPage />
      </ProfilePage>
    );
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      {signedIn ? (
        <View style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('account_auth.change_avatar')}
            disabled={account.busy || m.pickingAvatar}
            onPress={() => void m.pickAvatar()}
          >
            <AccountAvatar
              username={account.profile.username || account.profile.email}
              avatar={account.profile.avatar}
            />
          </Pressable>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
              <Text style={s.title} numberOfLines={1}>
                {account.profile.nickname}
              </Text>
              <Pressable accessibilityRole="button" onPress={m.edit} style={styles.edit}>
                <IconOutline name="edit" color={c.accent} size={13} />
                <Text style={s.link}>{text('edit')}</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text('email')}
              onPress={m.copyEmail}
              style={s.row}
            >
              <Text style={[s.muted, { flex: 1, flexShrink: 1 }]}>{account.profile.email}</Text>
              <IconOutline name="copy" size={14} color={c.muted} />
            </Pressable>
            <View style={styles.member}>
              <IconOutline name="desktop" size={12} color={c.accent} />
              <Text style={[s.link, { fontSize: 11 }]}>{text('member')}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.guestHeader}>
          <View style={styles.guestAvatar}>
            <IconOutline name="user" size={38} color={c.muted} />
          </View>
          <Text style={[s.title, { letterSpacing: 3 }]}>{text('guest')}</Text>
          <Text style={s.muted}>{text('guest_description')}</Text>
          <View style={[s.row, { marginTop: 12 }]}>
            <View style={{ flex: 1.2 }}>
              <PrimaryButton style={s.button} onPress={() => account.open('register')}>
                <View style={[s.row, { gap: 6 }]}>
                  <IconOutline name="mail" size={17} color="#142128" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#142128' }}>
                    {text('email_register')}
                  </Text>
                </View>
              </PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton type="ghost" style={s.outlined} onPress={onBrowse}>
                <View style={s.row}>
                  <IconOutline name="right" size={16} color={c.accent} />
                  <Text style={s.link}>{text('browse')}</Text>
                </View>
              </PrimaryButton>
            </View>
          </View>
        </View>
      )}
      {signedIn ? (
        <View style={s.panel}>
          <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
            <View style={s.row}>
              <IconOutline name="desktop" size={20} color={c.accent} />
              <Text style={[s.text, { fontWeight: '700' }]}>{text('my_room')}</Text>
            </View>
            {!!m.roomName && <Text style={styles.status}>{text('available')}</Text>}
          </View>
          <View style={s.row}>
            <Text style={styles.roomName}>{m.roomName || t('account_auth.room_unavailable')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text('copy_room')}
              onPress={m.copy}
              disabled={!m.roomName}
              style={styles.copy}
            >
              <IconOutline name="copy" size={20} color={c.text} />
            </Pressable>
          </View>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                disabled={joining || !m.roomName}
                onPress={() => onJoin(m.roomName)}
                style={s.button}
              >
                <View style={[s.row, { gap: 6 }]}>
                  <IconOutline name="video-camera" size={17} color="#142128" />
                  <Text style={{ color: '#142128', fontSize: 16 }}>{text('quick_meeting')}</Text>
                </View>
              </PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                type="ghost"
                disabled={!m.roomName}
                onPress={() => {
                  void m.share();
                }}
                style={{ borderColor: '#444' }}
              >
                <View style={[s.row, { gap: 6 }]}>
                  <IconOutline name="share-alt" size={16} color={c.text} />
                  <Text style={[s.text, { fontSize: 14 }]}>{text('share_room')}</Text>
                </View>
              </PrimaryButton>
            </View>
          </View>
        </View>
      ) : (
        <View style={[s.panel, s.row]}>
          <View style={styles.gift}>
            <IconOutline name="gift" color={c.accent} size={22} />
          </View>
          <Text style={[s.muted, { flex: 1, color: '#C6C6C6' }]}>
            {text('benefit_prefix')} <Text style={s.link}>{text('benefit_meetings')}</Text>{' '}
            {text('benefit_and')} <Text style={s.link}>{text('benefit_storage')}</Text>{' '}
            {text('benefit_suffix')}
          </Text>
        </View>
      )}
      {/* 我的内容尚未接入，暂时隐藏。
      <Section title={text('library')}>
        {signedIn ? (
          library
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text('locked')}
            onPress={() => account.open('login')}
          >
            <View pointerEvents="none" style={{ opacity: 0.16 }}>
              {library}
            </View>
            <View style={styles.locked}>
              <IconOutline name="lock" color={c.accent} size={16} />
              <Text style={[s.link, { flex: 1, fontSize: 12 }]}>{text('locked')}</Text>
            </View>
          </Pressable>
        )}
      </Section>
      */}
      <Section title={text('general')}>
        <Row
          icon="notification"
          title={text('notifications')}
          detail={text('notifications_detail')}
          trailing={
            <Switch
              accessibilityLabel={text('notifications')}
              checked={account.profile.notifications}
              disabled={!account.ready}
              onChange={(notifications) => account.update({ notifications })}
            />
          }
        />
        <Row
          icon="smile"
          title={text('gestures')}
          detail={text('gestures_detail')}
          trailing={
            <Switch
              accessibilityLabel={text('gestures')}
              checked={account.profile.gestures}
              disabled={!account.ready}
              onChange={(gestures) => account.update({ gestures })}
            />
          }
        />
        <Row icon="setting" title={text('preferences')} onPress={() => m.setPanel('preferences')} />
        <Row icon="question-circle" title={text('help')} onPress={() => m.setPanel('feedback')} />
        <Row icon="info-circle" title={text('about')} onPress={() => m.setPanel('about')} last />
      </Section>
      {signedIn && (
        <Pressable
          accessibilityRole="button"
          disabled={account.busy}
          onPress={() => {
            void onLogout();
          }}
          style={styles.logout}
        >
          <IconOutline name="logout" size={20} color="#FF5376" />
          <Text style={{ color: '#FF5376', fontSize: 16, letterSpacing: 2 }}>{text('logout')}</Text>
        </Pressable>
      )}
      {signedIn && (
        <Pressable
          accessibilityRole="button"
          disabled={account.busy}
          style={styles.logout}
          onPress={() => {
            m.setDeletePassword('');
            m.setPanel('delete');
          }}
        >
          <Text style={{ color: '#FF5376' }}>{t('account_auth.delete_account')}</Text>
        </Pressable>
      )}
      <SettingsDialog
        open={m.panel === 'delete'}
        title={t('account_auth.delete_account')}
        onClose={() => {
          if (!account.busy) {
            m.setDeletePassword('');
            m.setPanel(undefined);
          }
        }}
        confirmLabel={t('account_auth.delete_confirm')}
        disabled={account.busy || !m.deletePassword}
        onConfirm={() => {
          void onDelete(m.deletePassword).then((ok) => {
            if (ok) {
              m.setDeletePassword('');
              m.setPanel(undefined);
            }
          });
        }}
      >
        <Text style={s.muted}>{t('account_auth.delete_warning')}</Text>
        <Input
          value={m.deletePassword}
          onChangeText={m.setDeletePassword}
          secureTextEntry
          accessibilityLabel={text('password')}
          placeholder={text('password')}
          editable={!account.busy}
        />
        {account.error && (
          <Text accessibilityRole="alert" style={s.muted}>
            {t(account.error)}
          </Text>
        )}
      </SettingsDialog>
      {(account.error || model.error) && (
        <Text accessibilityRole="alert" style={s.muted}>
          {account.error ? t(account.error) : model.error}
        </Text>
      )}
      <SettingsDialog
        open={m.panel === 'edit'}
        title={text('edit')}
        onClose={() => {
          if (!account.busy && !m.pickingAvatar) m.setPanel(undefined);
        }}
        onConfirm={m.save}
        confirmLabel={t('auth.save')}
        disabled={!m.nickname.trim() || account.busy || m.pickingAvatar}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('account_auth.change_avatar')}
          disabled={account.busy || m.pickingAvatar}
          onPress={() => void m.pickAvatar()}
          style={{ alignItems: 'center', gap: 8, marginBottom: 16 }}
        >
          <AccountAvatar
            username={account.profile.username || account.profile.email}
            avatar={account.profile.avatar}
            size={80}
          />
          <Text style={s.link}>
            {t(m.pickingAvatar ? 'account_auth.avatar_uploading' : 'account_auth.change_avatar')}
          </Text>
          <Text style={s.muted}>{t('account_auth.avatar_hint')}</Text>
        </Pressable>
        {account.error && (
          <Text accessibilityRole="alert" style={s.muted}>
            {t(account.error)}
          </Text>
        )}
        <Text style={[s.muted, { marginBottom: 10 }]}>{account.profile.email}</Text>
        <Input
          accessibilityLabel={text('nickname')}
          placeholder={text('nickname')}
          value={m.nickname}
          onChangeText={m.setNickname}
          maxLength={30}
        />
      </SettingsDialog>
      <SettingsDialog
        open={m.panel === 'preferences'}
        title={text('preferences')}
        onClose={() => m.setPanel(undefined)}
        onConfirm={() => m.setPanel(undefined)}
        confirmLabel={text('close')}
      >
        <Text style={s.muted}>{t('settings.general.lang')}</Text>
        <LanguageSelect />
        {languageError && (
          <Text accessibilityRole="alert" style={s.muted}>
            {t(languageError)}
          </Text>
        )}
        {!signedIn && (
          <Input
            accessibilityLabel={text('nickname')}
            value={model.settings.nickname}
            onChangeText={(nickname) => model.update({ nickname })}
            maxLength={30}
            editable={model.ready}
          />
        )}
        <Row
          icon="sound"
          title={text('preview_muted')}
          trailing={
            <Switch
              accessibilityLabel={text('preview_muted')}
              checked={model.settings.previewMuted}
              disabled={!model.ready}
              onChange={(previewMuted) => model.update({ previewMuted })}
            />
          }
        />
        <Row
          icon="play-circle"
          title={text('auto_join')}
          trailing={
            <Switch
              accessibilityLabel={text('auto_join')}
              checked={model.settings.autoJoin}
              disabled={!model.ready}
              onChange={(autoJoin) => model.update({ autoJoin })}
            />
          }
          last
        />
        <Text style={s.muted}>{text('preview_hint')}</Text>
      </SettingsDialog>
    </ScrollView>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={s.row}>
        <Text style={s.muted}>{title}</Text>
        <View style={s.line} />
      </View>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}
function Row({
  icon,
  title,
  detail,
  trailing,
  onPress,
  last,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const content = (
    <>
      <IconOutline name={icon} size={20} color="#AAA" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.text}>{title}</Text>
        {detail && <Text style={[s.muted, { fontSize: 11, lineHeight: 15 }]}>{detail}</Text>}
      </View>
      {trailing || <IconOutline name="right" size={16} color="#888" />}
    </>
  );
  const style = [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: '#303030' }];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}
const styles = StyleSheet.create({
  identity: { flexDirection: 'row', gap: 12, paddingVertical: 18, alignItems: 'flex-start' },
  edit: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#22CCEE88',
    borderRadius: 4,
  },
  member: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: '#12343A',
    borderColor: '#22CCEE88',
    borderWidth: 1,
    borderRadius: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  guestHeader: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  guestAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#666',
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  status: {
    color: '#EDBC43',
    borderColor: '#846D24',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    backgroundColor: '#393422',
  },
  roomName: {
    flex: 1,
    flexShrink: 1,
    color: c.accent,
    fontWeight: '700',
    fontSize: 28,
    letterSpacing: 2,
  },
  copy: { padding: 8, borderWidth: 1, borderColor: '#3C3C3C', borderRadius: 20 },
  gift: { backgroundColor: '#202323', borderRadius: 20, padding: 9 },
  section: { backgroundColor: '#202020', borderRadius: 10, padding: 12, gap: 8 },
  rows: { borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14 },
  row: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
    minHeight: 59,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  logout: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
});
