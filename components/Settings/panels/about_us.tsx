import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';

export function AboutUs() {
  const { t } = useI18n();
  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
        <SvgResource type="logo" svgSize={64}></SvgResource>
        <span style={{ fontSize: '32px', color: '#fff', fontWeight: '700' }}>VoceSpace</span>
      </div>
      <div
        style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#FFFFFF',
          textAlign: 'left',
          width: '100%',
          wordSpacing: '0px',
        }}
      >
        {t('settings.about_us.brief')}
      </div>
      <div style={{ textAlign: 'justify', textIndent: '2rem' }}>{t('settings.about_us.desc')}</div>
      <div style={{ textAlign: 'right', width: '100%' }}>
        <div>
          {' '}
          {t('msg.info.contact')}
          <a
            href="mailto:han@privoce.com"
            style={{ color: '#22CCEE', textDecorationLine: 'none', margin: '0 4px' }}
          >
            han@privoce.com
          </a>
        </div>
        <div>
          {' '}
          {t('msg.info.learn_more')}:
          <a
            href="https://vocespace.com"
            style={{ color: '#22CCEE', textDecorationLine: 'none', margin: '0 4px' }}
          >
            {t('msg.info.offical_web')}
          </a>
        </div>
      </div>
    </div>
  );
}
