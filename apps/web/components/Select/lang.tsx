import { langOptions, useI18n } from '@/lib/i18n/i18n';
import { Select } from 'antd';
import { SelectPrefix } from './prefix';

export function LangSelect({ style }: { style?: React.CSSProperties }) {
  const { locale, changeLocale } = useI18n();
  return (
    <Select
      size="large"
      style={style}
      prefix={<SelectPrefix type="lang" svgSize={16} color="#22CCEE"></SelectPrefix>}
      value={locale}
      options={langOptions}
      onChange={(value) => {
        changeLocale(value);
      }}
    ></Select>
  );
}
