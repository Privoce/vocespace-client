import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgResource } from '../ui/SvgResource';
import { MailOutlined } from '../ui/MailOutlined';
import { useAuthForm } from '../account/useAuthForm';
import type { DemoAccountModel } from '../account/useDemoAccount';
import { accountColors as c, accountStyles as s } from '../account/styles';
import { useI18n } from '../i18n';
import { IconOutline, Input, PrimaryButton, Switch } from '../ui/controls';
export function AuthScreen({
  account,
  onBrowse,
}: {
  account: DemoAccountModel;
  onBrowse: () => void;
}) {
  const { t } = useI18n();
  const m = useAuthForm(account);
  const text = (key: string) => t(`native_account.${key}`);
  const notice = (title: string, message = 'not_connected') =>
    Alert.alert(text(title), text(message));
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brand}>
        <View style={styles.logo} accessibilityLabel="VoceSpace">
          <SvgResource type="logo2" width="100%" height={64} />
        </View>
        <Text style={[s.muted, { marginTop: 8 }]}>{text('brand_tagline')}</Text>
        <Text style={s.muted}>{text('brand_motto')}</Text>
      </View>
      <View style={styles.form}>
        <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <View style={styles.tabs}>
            {(['login', 'register'] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="tab"
                accessibilityState={{ selected: account.screen === mode }}
                disabled={account.busy}
                onPress={() => account.open(mode)}
                style={[styles.tab, account.screen === mode && { backgroundColor: c.accent }]}
              >
                <Text
                  style={{ fontSize: 16, color: account.screen === mode ? '#142128' : c.muted }}
                >
                  {text(mode)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: c.muted, fontSize: 11, letterSpacing: 1 }}>
            {text('email_register')}
          </Text>
        </View>
        <Input
          accessibilityLabel={text('email')}
          placeholder="voce@gmail.com"
          prefix={<MailOutlined size={20} color={c.muted} />}
          value={m.email}
          onChangeText={m.setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          editable={!account.busy}
          style={styles.input}
        />
        <Input
          accessibilityLabel={text('password')}
          placeholder={text('password')}
          prefix={<IconOutline name="lock" size={20} color={c.muted} />}
          value={m.password}
          onChangeText={m.setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={account.screen === 'register' ? 'newPassword' : 'password'}
          editable={!account.busy}
          style={styles.input}
          onSubmitEditing={() => {
            void m.submit();
          }}
        />
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <View style={[s.row, { gap: 6 }]}>
            <Switch
              accessibilityLabel={text('remember')}
              checked={m.remember}
              onChange={m.setRemember}
              disabled={account.busy}
            />
            <Text style={s.muted}>{text('remember')}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => notice('forgot', 'forgot_notice')}>
            <Text style={s.link}>{text('forgot')}</Text>
          </Pressable>
        </View>
        {(m.invalid || account.error) && (
          <Text accessibilityRole="alert" style={{ color: '#FF6B82', fontSize: 12 }}>
            {m.invalid ? text('email_invalid') : t(account.error!)}
          </Text>
        )}
        <PrimaryButton
          loading={account.busy}
          disabled={!account.ready || account.busy}
          style={s.button}
          onPress={() => {
            void m.submit();
          }}
        >
          {text('submit')}
        </PrimaryButton>
        <View style={[s.row, { marginTop: 4 }]}>
          <View style={s.line} />
          <Text style={{ color: c.muted, fontSize: 11 }}>{text('alternative')}</Text>
          <View style={s.line} />
        </View>
        <View style={styles.socials}>
          <View style={styles.socialItem}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gmail"
              onPress={() => notice('email_register')}
              style={styles.social}
            >
              <SvgResource type="google" svgSize={25} />
            </Pressable>
            <Text style={s.muted}>Gmail</Text>
          </View>
          <View style={styles.socialItem}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Email"
              onPress={() => account.open('register')}
              style={styles.social}
            >
              <MailOutlined size={25} color={c.accent} />
            </Pressable>
            <Text style={s.muted}>Email</Text>
          </View>
        </View>
        <Text style={styles.terms}>
          {text('terms_prefix')}{' '}
          <Text onPress={() => notice('terms', 'legal_notice')} style={s.link}>
            {text('terms')}
          </Text>{' '}
          {text('and')}{' '}
          <Text onPress={() => notice('privacy', 'legal_notice')} style={s.link}>
            {text('privacy')}
          </Text>
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      <PrimaryButton type="ghost" disabled={account.busy} style={styles.guest} onPress={onBrowse}>
        <View style={s.row}>
          <IconOutline name="right" color={c.muted} size={16} />
          <Text style={s.muted}>{text('guest_entry')}</Text>
        </View>
      </PrimaryButton>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 16, gap: 16 },
  brand: { alignItems: 'center', gap: 6, marginTop: 12 },
  logo: {
    width: 280,
    maxWidth: '100%',
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  form: {
    marginTop: 6,
    backgroundColor: '#282828',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    gap: 12,
  },
  tabs: { flexDirection: 'row', backgroundColor: '#202020', borderRadius: 4, padding: 3 },
  tab: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  input: {
    backgroundColor: '#202020',
    borderColor: '#424242',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    minHeight: 42,
  },
  socials: { flexDirection: 'row', justifyContent: 'space-around' },
  socialItem: { alignItems: 'center', gap: 5 },
  social: {
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#383838',
    borderRadius: 5,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terms: { fontSize: 11, color: c.muted, textAlign: 'center', lineHeight: 21 },
  guest: { alignSelf: 'center', borderColor: c.line, minHeight: 36 },
});
