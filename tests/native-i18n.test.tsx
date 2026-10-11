import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
vi.mock('../apps/mobile/node_modules/@react-native-async-storage/async-storage', () => ({
  default: storage,
}));
import { NativeI18nProvider, useI18n } from '../apps/mobile/src/i18n';
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
