import MeetingPreview from './src/dev/MeetingPreview';
import { NativeI18nProvider } from './src/i18n';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AuthScreen } from './src/screens/AuthScreen';
import { useAccount } from './src/account/useAccount';
import { HomeScreen } from './src/screens/HomeScreen';
import { MeetingsScreen } from './src/screens/MeetingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { useLocalSettings } from './src/settings/useLocalSettings';
import { antdTheme, colors, tabBarStyles, ui } from './src/theme';
import { useConference } from './src/conference/useConference';
import { AntProvider, IconOutline, TabBar, TabItem } from './src/ui/controls';

const tabs = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'meetings', label: '会议', icon: 'video-camera' },
  // { key: 'messages', label: '消息', icon: 'message' },
  { key: 'profile', label: '我的', icon: 'user' },
] as const;
type Tab = (typeof tabs)[number]['key'];

function MobileShell() {
  const [tab, setTab] = useState<Tab>('home');
  const account = useAccount();
  const settings = useLocalSettings();
  // Keep the connection owner above Ant Design's selected Tab pane.
  const conference = useConference();
  const nickname = account.signedIn
    ? account.profile.nickname
    : settings.settings.nickname.trim() || '访客';
  const join = (space: string) => {
    if (!account.ready || !settings.ready || conference.hasPendingCleanup) return;
    setTab('meetings');
    void conference.join(space, nickname, undefined, true);
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
                title={item.label}
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
                    accountEmail={account.signedIn ? account.profile.email : undefined}
                    model={conference}
                    nickname={nickname}
                    preferences={settings.settings}
                    preferencesReady={settings.ready}
                  />
                )}
                {/* Messages remains disabled until messaging is available. */}
                {item.key === 'profile' && (
                  <ProfileScreen
                    model={settings}
                    account={account}
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
