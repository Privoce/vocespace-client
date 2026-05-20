'use client';
import { useI18n } from '@/lib/i18n/i18n';
import { Button, Result } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// 直接跳转到new_space页面
export default function Page() {
  const router = useRouter();
  const isWeChat = navigator.userAgent.indexOf('MicroMessenger') > -1;
  const { t } = useI18n();

  const toBrowser = () => {
    const url = window.location.href;
    // 直接打开浏览器
    window.open(url, '_blank');
  };

  if (isWeChat) {
    // 提示使用浏览器打开
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

  useEffect(() => {
    if (!isWeChat) {
      router.push('/new_space');
    }
  }, [router, isWeChat]);
  return null;
}
