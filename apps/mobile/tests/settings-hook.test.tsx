import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import {
  parseNativeSettingsSnapshot,
  settingsRoles,
  settingsPermissionKeys,
} from '@vocespace/contracts';
vi.mock('../src/conference/useNativeDevices', () => ({ useNativeDevices: () => ({}) }));
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh' }),
}));
vi.mock('../src/ui/settings-elements', () => ({ createSettingsElements: () => ({}) }));
import { useRoomSettings } from '../src/conference/useRoomSettings';
const initial = parseNativeSettingsSnapshot({
  name: 'Ada',
  status: 'Online',
  volume: 100,
  openPromptSound: true,
  openShareAudio: false,
  blur: 0,
  screenBlur: 0,
  appAuth: 'read',
  avoList: [],
  virtual: { role: 'None', bg: '', enabled: false },
  audioProcessing: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
  permissions: Object.fromEntries(
    settingsRoles.map((role) => [
      role,
      Object.fromEntries(settingsPermissionKeys.map((key) => [key, role === 'owner'])),
    ]),
  ),
});
function setup() {
  const room = {
    settings: vi.fn().mockResolvedValue(initial),
    updateSettings: vi.fn(),
    raw: { name: 'demo', localParticipant: { name: 'Ada' } },
  };
  const hook = renderHook(() =>
    useRoomSettings(room as never, { connection: 'connected', media: {} } as never, []),
  );
  return { room, ...hook };
}
it('keeps edits after a failed write and clears only saved draft fields on success', async () => {
  const { room, result, unmount } = setup();
  await waitFor(() => expect(result.current.snapshot).toEqual(initial));
  act(() => result.current.edit({ status: 'Busy', name: 'New name' }));
  room.updateSettings.mockRejectedValueOnce(new Error('denied'));
  await act(async () => {
    expect(await result.current.save({ status: 'Busy' })).toBe(false);
  });
  expect(result.current.draft).toEqual({ status: 'Busy', name: 'New name' });
  room.updateSettings.mockResolvedValueOnce({ ...initial, status: 'Busy' });
  await act(async () => {
    expect(await result.current.save({ status: 'Busy' })).toBe(true);
  });
  expect(result.current.draft).toEqual({ name: 'New name' });
  expect(result.current.snapshot?.status).toBe('Busy');
  unmount();
});
it('ignores a read that began before a successful write', async () => {
  const { room, result, unmount } = setup();
  await waitFor(() => expect(result.current.snapshot).toBeDefined());
  let finish!: (value: unknown) => void;
  room.settings.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => result.current.retry());
  await waitFor(() => expect(room.settings).toHaveBeenCalledTimes(2));
  room.updateSettings.mockResolvedValueOnce({ ...initial, status: 'New' });
  await act(async () => {
    await result.current.save({ status: 'New' });
  });
  await act(async () => {
    finish(initial);
  });
  expect(result.current.snapshot?.status).toBe('New');
  unmount();
});
it('cancels pending settings writes on exit and never applies their late result', async () => {
  const { room, result, unmount } = setup();
  await waitFor(() => expect(result.current.snapshot).toBeDefined());
  let finish!: (value: unknown) => void;
  room.updateSettings.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let saving!: Promise<boolean>;
  act(() => {
    saving = result.current.save({ status: 'New' });
  });
  const signal = room.updateSettings.mock.calls[0][1] as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  finish({ ...initial, status: 'New' });
  expect(await saving).toBe(false);
});
