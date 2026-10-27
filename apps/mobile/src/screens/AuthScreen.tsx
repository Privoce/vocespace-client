import Checkbox from '@ant-design/react-native/lib/checkbox';
import { useLegalNavigation } from '../legal/hooks/useLegalNavigation';
import * as React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgResource } from '../ui/SvgResource';
import { MailOutlined } from '../ui/MailOutlined';
import { CodeInput } from '../account/CodeInput';
import { useAuthForm } from '../account/hooks/useAuthForm';
import type { AccountModel } from '../account/hooks/useAccount';
import { accountColors as c, accountStyles as s } from '../account/styles';
import { useI18n } from '../i18n';
import { IconOutline, Input, PrimaryButton, Switch } from '../ui/controls';
export function AuthScreen({ account, onBrowse }: { account: AccountModel; onBrowse: () => void }) {
  const { t } = useI18n();
  const m = useAuthForm(account);
  const openLegal = useLegalNavigation();
  const [visible, setVisible] = React.useState(false);
  const text = (key: string) => t(`native_account.${key}`);
  const auth = (key: string) => t(`account_auth.${key}`);
  const recovery = account.screen === 'forgot' || account.screen === 'reset';
  const reset = account.screen === 'reset';
  const register = account.screen === 'register';
  const resendLabel =
    m.seconds > 0 || m.registrationSent || reset ? auth('resend_code') : auth('send_code');
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
        {recovery ? (
          <>
            <View style={s.row}>
              <IconOutline name="lock" size={26} color={c.accent} />
              <View>
                <Text style={s.title}>{reset ? auth('reset_password') : text('forgot')}</Text>
                <Text style={[s.muted, { fontSize: 10, letterSpacing: 2 }]}>RESET PASSWORD</Text>
              </View>
            </View>
            <Text style={s.muted}>{auth(reset ? 'reset_code_hint' : 'forgot_code_hint')}</Text>
          </>
        ) : (
          <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
            <View style={styles.tabs}>
              {(['login', 'register'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: account.screen === mode }}
                  disabled={account.busy}
                  onPress={() => m.open(mode)}
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
            <Text style={{ color: c.muted, fontSize: 11 }}>{text('email_register')}</Text>
          </View>
        )}
        {reset ? (
          <Text style={s.muted}>{m.email}</Text>
        ) : (
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
        )}
        {reset && (
          <>
            <Text style={s.text}>{auth('code_label')}</Text>
            <CodeInput
              value={m.code}
              onChange={m.setCode}
              label={auth('code_label')}
              disabled={account.busy}
            />
          </>
        )}
        {account.screen !== 'forgot' && (
          <>
            {reset && <Text style={s.text}>{auth('new_password')}</Text>}
            <Input
              accessibilityLabel={reset ? auth('new_password') : text('password')}
              placeholder={reset ? auth('new_password') : text('password')}
              prefix={<IconOutline name="lock" size={20} color={c.muted} />}
              value={m.password}
              onChangeText={m.setPassword}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={register || reset ? 'newPassword' : 'password'}
              editable={!account.busy && !(register && m.registrationSent)}
              style={styles.input}
              suffix={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={auth(visible ? 'hide_password' : 'show_password')}
                  onPress={() => setVisible(!visible)}
                >
                  <IconOutline name={visible ? 'eye-invisible' : 'eye'} size={20} color={c.muted} />
                </Pressable>
              }
              onSubmitEditing={() => {
                void m.submit();
              }}
            />
          </>
        )}
        {register && (
          <>
            <Text style={s.text}>{auth('code_label')}</Text>
            <CodeInput
              value={m.code}
              onChange={m.setCode}
              label={auth('code_label')}
              disabled={account.busy}
            />
            {m.registrationSent && <Text style={s.muted}>{auth('registration_code_hint')}</Text>}
          </>
        )}
        {(register || reset) && (
          <PrimaryButton
            type="ghost"
            disabled={account.busy || m.seconds > 0 || (register && !m.accepted)}
            onPress={() => {
              void m.sendCode();
            }}
          >
            {resendLabel}
            {m.seconds > 0 ? ` (${m.seconds}s)` : ''}
          </PrimaryButton>
        )}
        {!recovery && (
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
            {!register && (
              <Pressable
                accessibilityRole="button"
                disabled={account.busy}
                onPress={() => m.open('forgot')}
              >
                <Text style={s.link}>{text('forgot')}</Text>
              </Pressable>
            )}
          </View>
        )}
        {!recovery && (
          <View style={[s.row, { alignItems: 'flex-start', gap: 4 }]}>
            <Checkbox
              checked={m.accepted}
              onChange={(event) => m.setAccepted(event.target.checked)}
              disabled={account.busy}
              accessibilityLabel={t('legal.accept_label')}
            />
            <Text style={[styles.terms, { flex: 1, textAlign: 'left' }]}>
              {t('legal.accept_prefix')}{' '}
              <Text accessibilityRole="link" onPress={() => openLegal('terms')} style={s.link}>
                {t('legal.terms')}
              </Text>{' '}
              {text('and')}{' '}
              <Text accessibilityRole="link" onPress={() => openLegal('privacy')} style={s.link}>
                {t('legal.privacy')}
              </Text>
            </Text>
          </View>
        )}
        {(m.invalid || account.error) && (
          <Text accessibilityRole="alert" style={{ color: '#FF6B82', fontSize: 12 }}>
            {t(m.invalid || account.error!)}
          </Text>
        )}
        {account.message && (
          <Text accessibilityRole="alert" style={s.link}>
            {t(account.message)}
          </Text>
        )}
        <PrimaryButton
          loading={account.busy}
          disabled={
            !account.ready ||
            account.busy ||
            (!recovery && !m.accepted) ||
            (account.screen === 'forgot' && m.seconds > 0)
          }
          style={s.button}
          onPress={() => {
            void m.submit();
          }}
        >
          {reset
            ? auth('save_reset')
            : account.screen === 'forgot'
              ? `${resendLabel}${m.seconds > 0 ? ` (${m.seconds}s)` : ''}`
              : text(register ? 'register' : 'login')}
        </PrimaryButton>
        {recovery ? (
          <>
            <View style={[s.line, { marginVertical: 12 }]} />
            <Pressable
              accessibilityRole="button"
              disabled={account.busy}
              onPress={() => m.open('login')}
            >
              <Text style={[s.link, { textAlign: 'center' }]}>{auth('back_login')} →</Text>
            </Pressable>
            {reset && (
              <Pressable
                accessibilityRole="button"
                disabled={account.busy}
                onPress={() => m.open('forgot')}
              >
                <Text style={[s.muted, { textAlign: 'center' }]}>{auth('change_email')}</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
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
                  onPress={() => m.open('register')}
                  style={styles.social}
                >
                  <MailOutlined size={25} color={c.accent} />
                </Pressable>
                <Text style={s.muted}>Email</Text>
              </View>
            </View>
          </>
        )}
      </View>
      <View style={{ flex: 1 }} />
      <PrimaryButton type="ghost" disabled={account.busy} style={styles.guest} onPress={onBrowse}>
        <Text style={s.muted}>{text('guest_entry')}</Text>
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
