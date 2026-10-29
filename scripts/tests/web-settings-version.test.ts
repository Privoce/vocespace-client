import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRoomEntry } from '../../apps/web/components/Room/hooks/UseRoomEntry';
import { useUserStore } from '../../apps/web/lib/store/user';
import {
  DEFAULT_PARTICIPANT_SETTINGS,
  PARTICIPANT_SETTINGS_KEY,
  VOCESPACE_PLATFORM_USER,
} from '@vocespace/domain/space';

vi.mock('@/lib/analytics/meeting', () => ({ webMeetingAnalytics: { end: vi.fn() } }));
vi.mock('@/lib/api', () => ({ api: { getConf: () => new Promise(() => {}) } }));
vi.mock('@/lib/i18n/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('antd', () => ({ notification: { useNotification: () => [null, null] } }));
vi.mock('@livekit/components-react', () => ({
  usePersistentUserChoices: () => ({ userChoices: { username: 'Guest' } }),
}));

const props = {
  spaceName: 'version-test',
  loading: false,
  setLoading: vi.fn(),
  messageApi: {},
} as Parameters<typeof useRoomEntry>[0];

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  useUserStore.getState().reset();
  localStorage.setItem(VOCESPACE_PLATFORM_USER, 'cached-platform-user');
  localStorage.setItem('unrelated-preference', 'keep');
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  localStorage.clear();
});

it.each(['0.5.5', '0.1.0'])('discards %s settings and platform cache on upgrade', (version) => {
  localStorage.setItem(PARTICIPANT_SETTINGS_KEY, JSON.stringify({ version, name: 'Old' }));
  renderHook(() => useRoomEntry(props));
  expect(localStorage.getItem(PARTICIPANT_SETTINGS_KEY)).toBeNull();
  expect(localStorage.getItem(VOCESPACE_PLATFORM_USER)).toBeNull();
  expect(localStorage.getItem('unrelated-preference')).toBe('keep');
  expect(useUserStore.getState().version).toBe(DEFAULT_PARTICIPANT_SETTINGS.version);
  expect(useUserStore.getState().name).toBe('');
});

it('restores current settings and keeps them on subsequent mounts', () => {
  const stored = JSON.stringify({ ...DEFAULT_PARTICIPANT_SETTINGS, name: 'Current' });
  localStorage.setItem(PARTICIPANT_SETTINGS_KEY, stored);
  const first = renderHook(() => useRoomEntry(props));
  expect(useUserStore.getState().name).toBe('Current');
  first.unmount();
  renderHook(() => useRoomEntry(props));
  expect(localStorage.getItem(PARTICIPANT_SETTINGS_KEY)).toBe(stored);
  expect(localStorage.getItem(VOCESPACE_PLATFORM_USER)).toBe('cached-platform-user');
});

it('discards malformed settings without breaking room entry', () => {
  localStorage.setItem(PARTICIPANT_SETTINGS_KEY, '{broken');
  renderHook(() => useRoomEntry(props));
  expect(localStorage.getItem(PARTICIPANT_SETTINGS_KEY)).toBeNull();
  expect(localStorage.getItem(VOCESPACE_PLATFORM_USER)).toBeNull();
});
