vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createTranslator, type Locale } from '@vocespace/i18n';
import type { ReactNode } from 'react';
let locale: Locale = 'en';
vi.mock('../src/theme', () => ({ colors: {}, tabBarStyles: { tabs: {} }, antdTheme: {}, ui: {} }));
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: createTranslator(locale) }) }));
vi.mock('../src/account/hooks/useAccount', () => ({ useAccount: () => ({ ready: true, profile: {}, signedIn: false }) }));
vi.mock('../src/settings/hooks/useLocalSettings', () => ({ useLocalSettings: () => ({ ready: true, settings: { nickname: '' } }) }));
vi.mock('../src/conference/hooks/useConference', () => ({ useConference: () => ({ state: { phase: 'idle' } }) }));
vi.mock('../src/ui/controls', () => ({
  TabBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabItem: ({ title }: { title: string }) => <button>{title}</button>,
  IconOutline: () => null,
}));
vi.mock('../src/dev/MeetingPreview', () => ({ default: () => null }));
vi.mock('../src/screens/AuthScreen', () => ({ AuthScreen: () => null }));
vi.mock('../src/screens/HomeScreen', () => ({ HomeScreen: () => null }));
vi.mock('../src/screens/MeetingsScreen', () => ({ MeetingsScreen: () => null }));
vi.mock('../src/screens/ProfileScreen', () => ({ ProfileScreen: () => null }));
vi.mock('../src/legal/LegalPages', () => ({ LegalPages: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: () => null }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('expo-font', () => ({ useFonts: () => [true] }));
import { MobileShell } from '../App';
afterEach(cleanup);
it('updates all tab labels when the application language changes', () => {
  locale = 'en';
  const view = render(<MobileShell />);
  expect(screen.getAllByRole('button').map(x => x.textContent)).toEqual(['Home', 'Meetings', 'Me']);
  locale = 'ru';
  view.rerender(<MobileShell />);
  expect(screen.getAllByRole('button').map(x => x.textContent)).toEqual(['Главная', 'Встречи', 'Профиль']);
  locale = 'zh';
  view.rerender(<MobileShell />);
  expect(screen.getAllByRole('button').map(x => x.textContent)).toEqual(['首页', '会议', '我的']);
});
