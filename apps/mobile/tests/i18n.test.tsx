import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
const device = vi.hoisted(() => ({
  read: vi.fn(),
  foreground: undefined as undefined | ((state: string) => void),
  remove: vi.fn(),
}));
vi.mock('../src/i18n/system-language', () => ({ readSystemLanguage: device.read }));
vi.mock('../src/ui/SettingsIcon', () => ({ SettingsIcon: () => null }));
vi.mock('../src/ui/settings-widgets', () => ({
  SettingsSelect: ({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (value: string) => void;
  }) => (
    <select aria-label={label} value={value} onChange={(event) => onChange?.(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      device.foreground = listener;
      return { remove: device.remove };
    },
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: storage,
}));
import { NativeI18nProvider, useI18n } from '../src/i18n';
import { LanguageSelect } from '../src/ui/LanguageSelect';
function Fixture() {
  const { t, locale, changeLocale, error } = useI18n();
  return (
    <>
      <output>
        {locale}:{t('settings.title')}
      </output>
      <button onClick={() => changeLocale('ru')}>Russian</button>
      <button onClick={() => changeLocale('zh')}>Chinese</button>
      {error && <p role="alert">{t(error)}</p>}
    </>
  );
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  storage.getItem.mockResolvedValue('zh');
  storage.setItem.mockResolvedValue(undefined);
  device.read.mockResolvedValue('en');
});
it('follows the system until a manual choice is made, and removes the foreground listener', async () => {
  storage.getItem.mockResolvedValue(null);
  device.read.mockResolvedValue('ru');
  const view = render(
    <NativeI18nProvider>
      <Fixture />
    </NativeI18nProvider>,
  );
  await screen.findByText('ru:Настройки');
  expect(storage.setItem).not.toHaveBeenCalled();
  device.read.mockResolvedValue('zh');
  await act(async () => device.foreground?.('active'));
  expect(screen.getByText('zh:设置')).toBeTruthy();
  fireEvent.click(screen.getByText('Russian'));
  await act(async () => device.foreground?.('active'));
  expect(screen.getByText('ru:Настройки')).toBeTruthy();
  view.unmount();
  expect(device.remove).toHaveBeenCalledOnce();
});
it('does not let a late system result replace a saved language', async () => {
  let finish!: (locale: string) => void;
  device.read.mockImplementationOnce(() => new Promise((resolve) => {
    finish = resolve;
  }));
  render(
    <NativeI18nProvider>
      <Fixture />
    </NativeI18nProvider>,
  );
  await screen.findByText('zh:设置');
  await act(async () => finish('ru'));
  expect(screen.getByText('zh:设置')).toBeTruthy();
});
it('ignores an invalid saved preference and uses English if detection is unavailable', async () => {
  storage.getItem.mockResolvedValue('invalid');
  render(
    <NativeI18nProvider>
      <Fixture />
    </NativeI18nProvider>,
  );
  await screen.findByText('en:Settings');
  expect(storage.setItem).not.toHaveBeenCalled();
});
it('shares and persists the choice between profile and meeting selectors across restarts', async () => {
  const content = (
    <NativeI18nProvider>
      <LanguageSelect />
      <LanguageSelect />
    </NativeI18nProvider>
  );
  const view = render(content);
  await waitFor(() =>
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('zh'),
  );
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'ru' } });
  await waitFor(() => expect(storage.setItem).toHaveBeenLastCalledWith('vocespace.locale.v1', 'ru'));
  expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe('ru');
  view.unmount();
  storage.getItem.mockResolvedValue('ru');
  render(content);
  await waitFor(() =>
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('ru'),
  );
});
it('restores a saved language and translates all mounted settings immediately', async () => {
  render(
    <NativeI18nProvider>
      <Fixture />
    </NativeI18nProvider>,
  );
  await waitFor(() => expect(screen.getByText('zh:设置')).toBeTruthy());
  fireEvent.click(screen.getByText('Russian'));
  await waitFor(() => expect(screen.getByText('ru:Настройки')).toBeTruthy());
  expect(storage.setItem).toHaveBeenCalledWith('vocespace.locale.v1', 'ru');
});
it('does not overwrite a new choice with a late disk read', async () => {
  let resolve!: (locale: string) => void;
  storage.getItem.mockImplementation(
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  render(
    <NativeI18nProvider>
      <Fixture />
    </NativeI18nProvider>,
  );
  fireEvent.click(screen.getByText('Russian'));
  await act(async () => resolve('zh'));
  expect(screen.getByText('ru:Настройки')).toBeTruthy();
});
it('serializes rapid changes and reports persistence failure without reverting the visible language', async () => {
  let resolve!: () => void;
  storage.setItem.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  render(
    <NativeI18nProvider>
      <Fixture />
    </NativeI18nProvider>,
  );
  await screen.findByText('zh:设置');
  fireEvent.click(screen.getByText('Russian'));
  fireEvent.click(screen.getByText('Chinese'));
  await waitFor(() => expect(storage.setItem).toHaveBeenCalledTimes(1));
  await act(async () => resolve());
  await waitFor(() =>
    expect(storage.setItem).toHaveBeenLastCalledWith('vocespace.locale.v1', 'zh'),
  );
  storage.setItem.mockRejectedValueOnce(new Error('disk unavailable'));
  fireEvent.click(screen.getByText('Russian'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('ru:Настройки')).toBeTruthy();
});
