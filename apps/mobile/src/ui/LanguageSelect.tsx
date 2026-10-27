import { langOptions } from '@vocespace/i18n';
import { useI18n } from '../i18n';
import { SettingsIcon } from './SettingsIcon';
import { SettingsSelect } from './settings-widgets';

/** One language preference shared by profile and meeting settings. */
export function LanguageSelect() {
  const { t, locale, changeLocale } = useI18n();
  return (
    <SettingsSelect
      label={t('settings.general.lang')}
      icon={<SettingsIcon name="lang" color="#22CCEE" size={16} />}
      value={locale}
      options={langOptions}
      onChange={changeLocale}
    />
  );
}
