import { useI18n } from '@/lib/i18n/i18n';
import { Alert } from 'antd';

interface LicenseAlertProps {
  toBuyRoomLicense: () => void;
}

export const LicenseAlert = ({ toBuyRoomLicense }: LicenseAlertProps) => {
  const { locale } = useI18n();

  return <Alert
    type="warning"
    showIcon
    closable
    message={
      <>
        {locale === 'zh' && (
          <span>
            {' '}
            目前是试用版本， <a onClick={toBuyRoomLicense}>订阅VoceSpace</a>
            后无限制使用，每年仅需49$。
          </span>
        )}
        {locale === 'en' && (
          <span>
            {' '}
            <a onClick={toBuyRoomLicense}>Upgrade now</a> to use VoceSpace without limits for only
            49$ annually.
          </span>
        )}
        {locale === 'ru' && (
          <span>
            {' '}
            <a onClick={toBuyRoomLicense}>Покупите VoceSpace</a> без ограничений за 49$ в год.
          </span>
        )}
      </>
    }
    style={{ margin: '8px 8px 0 8px', flexShrink: 0, width: 'calc(100% - 16px)' }}
  />;
};
