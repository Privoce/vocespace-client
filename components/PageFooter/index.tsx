import styles from './index.module.scss';
import { useI18n } from '@/lib/i18n/i18n';
import { Skeleton } from 'antd';

export interface PageFooterProps {
  loading: boolean;
}

export const PageFooter = ({ loading }: PageFooterProps) => {
  const { t } = useI18n();

  if (loading) {
    return (
      <Skeleton.Node
        active
        style={{ height: `67px`, backgroundColor: '#333', width: '100%' }}
      ></Skeleton.Node>
    );
  }

  return (
    <footer className={styles.footer}>
      <div>
        support <a href="mailto:han@privoce.com">han@privoce.com</a>
      </div>
      <div>
        © 2026 Privoce Inc.
        <a href="https://vocespace.com">{t('msg.info.offical_web')}</a>
      </div>
    </footer>
  );
};
