import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  licenseDetailKeys,
  LicenseSettingsContent,
  LicenseUpdateContent,
  LicenseCancelContent,
  type SettingsViewProps,
} from '@vocespace/ui';
import { Button, Input, SettingsDialog, SettingsNote } from '../../ui/settings-widgets';

/** Presentation adapter. A capability must provide an authorized operation before any write is enabled. */
export function LicenseSettings({ common }: { common: SettingsViewProps }) {
  const { t } = common;
  const [dialog, setDialog] = useState<'update' | 'cancel'>();
  const [license, setLicense] = useState('');
  const [email, setEmail] = useState('');
  const close = () => {
    setDialog(undefined);
    setLicense('');
    setEmail('');
  };
  return LicenseSettingsContent({
    ...common,
    slots: {
      calendar: null,
      updateDialog: (
        <SettingsDialog
          open={dialog === 'update'}
          title={t('settings.license.update')}
          onClose={close}
          confirmLabel={t('settings.license.update')}
          disabled
        >
          <SettingsNote>{t('native_settings.license_unavailable')}</SettingsNote>
          {LicenseUpdateContent({
            ...common,
            circleIp: false,
            slots: {
              ip: null,
              license: (
                <Input
                  value={license}
                  onChangeText={setLicense}
                  multiline
                  placeholder={t('settings.license.input')}
                  disabled
                />
              ),
            },
          })}
        </SettingsDialog>
      ),
      cancelDialog: (
        <SettingsDialog
          open={dialog === 'cancel'}
          title={t('settings.license.cancel_subscription')}
          onClose={close}
          confirmLabel={t('settings.license.cancel_subscription')}
          disabled
        >
          {LicenseCancelContent({
            ...common,
            email: (
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder={t('settings.license.cancel_email_placeholder')}
                disabled
              />
            ),
          })}
        </SettingsDialog>
      ),
      details: (
        <>
          <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 16 }}>
            {t('settings.license.title')}
          </Text>
          <View style={{ borderWidth: 1, borderColor: '#303030', borderRadius: 4 }}>
            {licenseDetailKeys.map((key) => (
              <View
                key={key}
                style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#303030' }}
              >
                <Text
                  style={{
                    width: '46%',
                    padding: 12,
                    color: '#8f8f8f',
                    backgroundColor: '#1E1E1E',
                  }}
                >
                  {t(`settings.license.${key}`)}
                </Text>
                <Text style={{ flex: 1, padding: 12, color: '#8E99AB' }}>—</Text>
              </View>
            ))}
          </View>
          <SettingsNote>{t('native_settings.license_unavailable')}</SettingsNote>
        </>
      ),
      buy: <Button disabled>{t('settings.license.buy')}</Button>,
      cancel: null,
      update: <Button onPress={() => setDialog('update')}>{t('settings.license.update')}</Button>,
    },
  });
}
