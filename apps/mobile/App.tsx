import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { HomeScreen } from './src/screens/HomeScreen';
import { MeetingsScreen } from './src/screens/MeetingsScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { useLocalSettings } from './src/settings/useLocalSettings';
import { antdTheme, colors, tabBarStyles, ui } from './src/theme';
import { useConference } from './src/conference/useConference';
import { AntProvider, IconOutline, TabBar, TabItem } from './src/ui/controls';

const tabs = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'meetings', label: '会议', icon: 'video-camera' },
  { key: 'messages', label: '消息', icon: 'message' },
  { key: 'profile', label: '我的', icon: 'user' },
] as const;
type Tab = (typeof tabs)[number]['key'];

function MobileShell() {
  const [tab, setTab] = useState<Tab>('home');
  const settings = useLocalSettings();
  // Keep the connection owner above Ant Design's selected Tab pane.
  const conference = useConference();
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
        <TabBar
          tintColor={colors.accent}
          unselectedTintColor={colors.muted}
          barTintColor={colors.surface}
          styles={tabBarStyles}
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
                  openMeetings={() => {
                    void changeTab('meetings');
                  }}
                />
              )}
              {item.key === 'meetings' && (
                <MeetingsScreen model={conference} nickname={settings.settings.nickname} />
              )}
              {item.key === 'messages' && <MessagesScreen />}
              {item.key === 'profile' && <ProfileScreen model={settings} />}
            </TabItem>
          ))}
        </TabBar>
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
            <MobileShell />
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
