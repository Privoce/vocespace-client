import { requireOptionalNativeModule } from 'expo';
import { resolveLocale, type Locale } from '@vocespace/i18n';

/** Read the first preferred system language, never a location or an IP address. */
export async function readSystemLanguage(): Promise<Locale> {
  try {
    // Existing development builds may not include this newly added native module yet.
    if (!requireOptionalNativeModule('ExpoLocalization')) return 'en';
    const { getLocales } = await import('expo-localization');
    const preferred = getLocales()[0];
    return resolveLocale(preferred?.languageCode || preferred?.languageTag, 'en');
  } catch {
    return 'en';
  }
}
