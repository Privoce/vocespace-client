'use client';
import { basePath as configuredBasePath } from '@/lib/runtime-config';

import Script from 'next/script';
import { publicConfig } from '../runtime-config';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { webAnalyticsPage, analyticsLanguage } from '@vocespace/contracts';
import { useI18n } from '@/lib/i18n/i18n';
import { getLayoutDevice } from '@/lib/layout-device';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';
import {
  analytics,
  setWebAnalyticsContext,
  flushWebAnalytics,
  webAnalyticsEnabled,
} from './index';
export function AnalyticsProvider() {
  const { url: umamiHost, websiteId: umamiWebsite } = publicConfig().analytics;
  const pathname = usePathname();
  const { locale, ready } = useI18n();
  const layout = useLayoutDevice();
  useEffect(() => {
    if (!ready) return;
    setWebAnalyticsContext({ language: analyticsLanguage(locale), layout: getLayoutDevice() });
    const page = webAnalyticsPage(pathname || '/', configuredBasePath);
    analytics.scope(!!page);
    if (page) analytics.page(page);
  }, [pathname, locale, layout, ready]);
  if (
    !ready ||
    !webAnalyticsEnabled() ||
    !webAnalyticsPage(pathname || '/', configuredBasePath)
  )
    return null;
  return (
    <Script
      id="vocespace-umami"
      src={`${umamiHost.replace(/\/$/, '')}/script.js`}
      data-website-id={umamiWebsite}
      data-auto-track="false"
      referrerPolicy="no-referrer"
      strategy="afterInteractive"
      onReady={flushWebAnalytics}
    />
  );
}
