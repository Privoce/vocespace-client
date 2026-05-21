'use client';

import { useI18n } from '@/lib/i18n/i18n';
import { Button, Result } from 'antd';
import React from 'react';

export function WeChatAccessGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [isWeChat, setIsWeChat] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setIsWeChat(window.navigator.userAgent.indexOf('MicroMessenger') > -1);
  }, []);

  const toBrowser = () => {
    window.open(window.location.href, '_blank');
  };

  if (isWeChat) {
    return (
      <Result
        status="warning"
        title={t('common.wx.not_support')}
        extra={
          <Button type="primary" onClick={toBrowser}>
            {t('common.wx.to_browser')}
          </Button>
        }
      />
    );
  }

  if (isWeChat === null) {
    return null;
  }

  return <>{children}</>;
}