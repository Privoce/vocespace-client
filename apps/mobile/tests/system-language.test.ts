import { beforeEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ available: vi.fn(), locales: vi.fn() }));
vi.mock('expo', () => ({ requireOptionalNativeModule: native.available }));
vi.mock('expo-localization', () => ({ getLocales: native.locales }));
import { readSystemLanguage } from '../src/i18n/system-language';

beforeEach(() => {
  native.available.mockReset().mockReturnValue({});
  native.locales.mockReset();
});

it.each([
  ['zh-Hans-CN', 'zh'],
  ['zh-TW', 'zh'],
  ['ru-RU', 'ru'],
  ['en-CN', 'en'],
  ['en-US', 'en'],
  ['fr-FR', 'en'],
])('maps the preferred language %s to %s', async (languageTag, expected) => {
  native.locales.mockReturnValue([{ languageTag }]);
  expect(await readSystemLanguage()).toBe(expected);
});

it('uses only the first preference, not a lower-priority supported language', async () => {
  native.locales.mockReturnValue([{ languageCode: 'de' }, { languageCode: 'ru' }]);
  expect(await readSystemLanguage()).toBe('en');
});

it('falls back to English for empty or failed detection and older native builds', async () => {
  native.locales.mockReturnValue([]);
  expect(await readSystemLanguage()).toBe('en');
  native.locales.mockImplementation(() => {
    throw new Error('unavailable');
  });
  expect(await readSystemLanguage()).toBe('en');
  native.available.mockReturnValue(null);
  native.locales.mockClear();
  expect(await readSystemLanguage()).toBe('en');
  expect(native.locales).not.toHaveBeenCalled();
});
