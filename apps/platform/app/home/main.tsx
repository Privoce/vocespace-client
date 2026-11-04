'use client';
import { useEffect, useState } from 'react';
import { Spin, Empty, List, Alert, Button, FloatButton } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { SpaceCard } from '../../components/space/card';
import { useI18n } from '../../lib/i18n/i18n';
import { allSpaces, type DiscoveryResult } from '../../lib/api/vocespace/space';
import styles from '../../styles/home_main.module.scss';

export function DisplaySpaces() {
  const [data, setData] = useState<DiscoveryResult>({ spaces: [], unavailable: [] });
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const { t } = useI18n();
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    setLoading(true);
    void allSpaces(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData({ spaces: [], unavailable: ['catalog', 'live'] });
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  const failure =
    data.unavailable.length === 2
      ? 'discovery.failed'
      : data.unavailable[0] === 'catalog'
        ? 'discovery.catalogFailed'
        : 'discovery.liveFailed';
  return (
    <section className={styles.space} aria-label={t('discovery.title')}>
      <div className={styles.space_tabs}>
        {!loading && data.unavailable.length > 0 && (
          <Alert
            showIcon
            type={data.unavailable.length === 2 ? 'error' : 'warning'}
            message={t(failure)}
            role="alert"
            action={
              <Button onClick={() => setAttempt((value) => value + 1)}>
                {t('discovery.retry')}
              </Button>
            }
          />
        )}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin size="large" />
          </div>
        ) : data.spaces.length > 0 ? (
          <List
            grid={{ gutter: 20, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 3 }}
            dataSource={data.spaces}
            rowKey={(space) => space.id || space.url}
            renderItem={(space) => (
              <List.Item>
                <SpaceCard space={space} />
              </List.Item>
            )}
          />
        ) : data.unavailable.length === 0 ? (
          <Empty
            description={t('discovery.empty')}
            style={{ margin: '40px 0' }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : null}
      </div>
      <FloatButton
        icon={<PlusOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24 }}
        onClick={() => router.push('/space/edit')}
        tooltip={t('space.pub.ok')}
      />
    </section>
  );
}
