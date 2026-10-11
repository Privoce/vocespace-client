import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, isLocale, resolveLocale, translations } from '@vocespace/i18n';
import { settingsIcons, settingsVector } from '@vocespace/ui';
import { SvgResource } from '../apps/web/components/Icon';
import { OriginalSettingsIcon } from './fixtures/settings-icons-original';
import { meetingSettingsSections } from '@vocespace/ui';

describe('One source of settings wording and vector assets', () => {
  it('keeps every original SVG element and attribute, including the gradient logo', () => {
    for (const name of Object.keys(settingsIcons) as (keyof typeof settingsIcons)[]) {
      for (const props of [
        { svgSize: 14, color: '#ffffff' },
        { svgSize: 64, color: '#22CCEE' },
        { svgSize: '1em', color: '#E7EDF5' },
      ]) {
        expect(renderToStaticMarkup(<SvgResource type={name} {...props} />)).toBe(
          renderToStaticMarkup(<OriginalSettingsIcon type={name} {...props} />),
        );
        const vector = settingsVector(name, props.svgSize, props.color);
        expect(vector.attrs.width).toBe(props.svgSize);
        expect(JSON.stringify(vector)).not.toMatch(/\$(?:color|svgSize)/);
      }
    }
  });
  it('uses the exact Web category labels in all supported languages', () => {
    expect(
      meetingSettingsSections
        .filter((section) => section.id !== 'ai')
        .map((section) => createTranslator('zh')(section.labelKey)),
    ).toEqual(['常规', 'AVO形象', '权限', '音频', '视频', '应用', '录制记录', '证书', '关于我们']);
    for (const locale of ['zh', 'en', 'ru'] as const) {
      const t = createTranslator(locale);
      for (const section of meetingSettingsSections)
        expect(t(section.labelKey)).not.toBe(section.labelKey);
      expect(t('settings.title')).not.toBe('settings.title');
      expect(t('settings.ai.recommand.1')).not.toBe('settings.ai.recommand.1');
    }
  });
  it('handles unsupported stored locales and missing/non-string keys without throwing or leaking objects', () => {
    expect(resolveLocale('zh-Hans-CN')).toBe('zh');
    expect(resolveLocale('ru_RU')).toBe('ru');
    expect(resolveLocale('invalid')).toBe('en');
    expect(isLocale('__proto__')).toBe(false);
    expect(createTranslator('zh')('settings')).toBe('settings');
    expect(createTranslator('zh')('constructor')).toBe('constructor');
    expect(createTranslator('zh')('absent.translation')).toBe('absent.translation');
    expect(Object.keys(translations)).toEqual(['en', 'zh', 'ru']);
  });
});
