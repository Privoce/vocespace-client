import { useEffect } from 'react';
import { analyticsLanguage } from '@vocespace/contracts';
import { setNativeAnalyticsContext } from './src/analytics';
import { useAnalyticsPage } from './src/analytics/hooks/useAnalyticsPage';
import { LegalPages } from './src/legal/LegalPages';
import MeetingPreview from './src/dev/MeetingPreview';
import { NativeI18nProvider, useI18n } from './src/i18n';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AuthScreen } from './src/screens/AuthScreen';
import { useAccount } from './src/account/hooks/useAccount';
import { HomeScreen } from './src/screens/HomeScreen';
import { MeetingsScreen } from './src/screens/MeetingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { useLocalSettings } from './src/settings/hooks/useLocalSettings';
import { antdTheme, colors, tabBarStyles, ui } from './src/theme';
import { useConference } from './src/conference/hooks/useConference';
import { AntProvider, IconOutline, TabBar, TabItem } from './src/ui/controls';

const tabs = [
  { key: 'home', icon: 'home' },
  { key: 'meetings', icon: 'video-camera' },
  // { key: 'messages', label: '消息', icon: 'message' },
  { key: 'profile', icon: 'user' },
] as const;
type Tab = (typeof tabs)[number]['key'];

export function MobileShell() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>('home');
  const account = useAccount();
  useEffect(() => {
    setNativeAnalyticsContext({ language: analyticsLanguage(locale), auth_state: account.ready ? account.signedIn ? 'signed_in' : 'guest' : 'unknown' });
  }, [locale, account.ready, account.signedIn]);
  const settings = useLocalSettings();
  // Keep the connection owner above Ant Design's selected Tab pane.
  const conference = useConference();
  useAnalyticsPage(!account.ready ? undefined : account.screen
    ? account.screen === 'reset' ? 'reset_password' : account.screen === 'forgot' ? 'forgot_password' : account.screen
    : conference.state.phase === 'joined' ? 'conference' : tab === 'meetings' ? undefined : tab,
    true, account.screen ? 5 : 0);
  const nickname = account.signedIn
    ? account.profile.nickname
    : settings.settings.nickname.trim() || t('native_account.guest');
  const join = (space: string) => {
    if (!account.ready || !settings.ready || conference.hasPendingCleanup) return;
    setTab('meetings');
    void conference.join(space, nickname, undefined, true, { source: tab === 'profile' ? 'profile' : 'home' });
  };
  const changeTab = async (next: Tab) => {
    if (next === tab) return;
    if (tab === 'meetings' && !(await conference.leave())) return;
    setTab(next);
  };
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LegalPages>
          {!account.ready ? (
            <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />
          ) : account.screen ? (
            <AuthScreen
              account={account}
              onBrowse={() => {
                account.browse();
                setTab('meetings');
              }}
            />
          ) : (
            <TabBar
              tintColor={colors.accent}
              unselectedTintColor={colors.muted}
              barTintColor={colors.surface}
              styles={{
                ...tabBarStyles,
                tabs: {
                  ...tabBarStyles.tabs,
                  // Ant's WithTheme retains merged styles; omission does not undo display:none.
                  ...(tab === 'meetings' &&
                  (conference.state.phase === 'joined' ||
                    conference.state.phase === 'joining' ||
                    conference.hasPendingCleanup)
                    ? { display: 'none' as const }
                    : { display: 'flex' as const }),
                },
              }}
            >
              {tabs.map((item) => (
                <TabItem
                  key={item.key}
                  title={t(`native_tabs.${item.key}`)}
                  selected={tab === item.key}
                  icon={<IconOutline name={item.icon} size={24} color={colors.muted} />}
                  selectedIcon={<IconOutline name={item.icon} size={24} color={colors.accent} />}
                  onPress={() => {
                    void changeTab(item.key);
                  }}
                >
                  {item.key === 'home' && (
                    <HomeScreen
                      model={conference}
                      onJoin={join}
                      openMeetings={() => {
                        void changeTab('meetings');
                      }}
                    />
                  )}
                  {item.key === 'meetings' && (
                    <MeetingsScreen
                      account={account}
                      active={tab === 'meetings'}
                      onPreferences={settings.update}
                      model={conference}
                      nickname={nickname}
                      preferences={settings.settings}
                      preferencesReady={settings.ready}
                    />
                  )}
                  {/* Messages remains disabled until messaging is available. */}
                  {item.key === 'profile' && (
                    <ProfileScreen
                      active={tab === 'profile'}
                      model={settings}
                      account={account}
                      sendFeedback={conference.feedback}
                      joining={!settings.ready || conference.hasPendingCleanup}
                      onJoin={join}
                      onBrowse={() => {
                        void changeTab('meetings');
                      }}
                      onDelete={async (password) => {
                        if (!(await conference.leave())) return false;
                        return account.remove(password);
                      }}
                      onLogout={async () => {
                        if (await conference.leave()) await account.logout();
                      }}
                    />
                  )}
                </TabItem>
              ))}
            </TabBar>
          )}
        </LegalPages>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    antoutline: require('@ant-design/icons-react-native/fonts/antoutline.ttf'),
    antfill: require('@ant-design/icons-react-native/fonts/antfill.ttf'),
  });
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AntProvider theme={antdTheme}>
          {fontsLoaded ? (
            <NativeI18nProvider>
              {__DEV__ && process.env.EXPO_PUBLIC_MEETING_UI_PREVIEW === '1' ? (
                <MeetingPreview />
              ) : (
                <MobileShell />
              )}
            </NativeI18nProvider>
          ) : (
            <SafeAreaView style={[styles.root, ui.page]}>
              {fontError ? (
                <Text style={ui.body}>图标资源加载失败，请重新打开应用。</Text>
              ) : (
                <ActivityIndicator color={colors.accent} />
              )}
            </SafeAreaView>
          )}
        </AntProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
});
