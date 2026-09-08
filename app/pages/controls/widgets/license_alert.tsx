import { useI18n } from '@/lib/i18n/i18n';
import { isWeChatBrowser } from '@/lib/std';
import { Alert } from 'antd';
import { useMemo } from 'react';

interface LicenseAlertProps {
  toBuyRoomLicense: () => void;
}

export const LicenseAlert = ({ toBuyRoomLicense }: LicenseAlertProps) => {
  const { t } = useI18n();
  const isWeChat = useMemo(() => isWeChatBrowser(), []);

  return (
    <Alert
      type="warning"
      showIcon
      closable
      message={
        isWeChat ? (
          <span>{t('common.wx.not_support')}</span>
        ) : (
          <span>
            {t('common.license_alert.trial_prefix')}
            <a onClick={toBuyRoomLicense}>{t('common.license_alert.trial_action')}</a>
            {t('common.license_alert.trial_suffix')}
          </span>
        )
      }
      style={{ margin: '8px 0px 0 8px', flexShrink: 0, width: 'calc(100% - 8px)' }}
    />
  );
};
