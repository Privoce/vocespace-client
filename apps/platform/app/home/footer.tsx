'use client';
import styles from '../../styles/home_footer.module.scss';
import { PolicyLinks } from '../../components/legal/PolicyLinks';
import { useI18n } from '../../lib/i18n/i18n';
export function HomeFooter() {
  const { t } = useI18n();
  return (
    <footer className={styles.footer}>
      <div>
        <PolicyLinks />
      </div>
      <div>{t('common.copyright')}</div>
    </footer>
  );
}
