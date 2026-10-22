import { Text, View } from 'react-native';
import {
  AISettingsContent,
  AIAnalysisContent,
  AIDeploymentContent,
  type SettingsViewProps,
} from '@vocespace/ui';
import {
  Button,
  Input,
  SettingsChoice,
  SettingsNote,
  SettingsToggle,
} from '../../ui/settings-widgets';
import { IconOutline, IconFill } from '../../ui/controls';
export function AISettings({ common }: { common: SettingsViewProps }) {
  const { t } = common;
  const info = (key: string) => (
    <IconFill accessibilityLabel={t(key)} name="info-circle" color="#aaa" size={14} />
  );
  return (
    <>
      {AISettingsContent({
        ...common,
        slots: {
          analysis: AIAnalysisContent({
            ...common,
            isPanel: false,
            manager: false,
            owner: false,
            hasSpace: true,
            showSettings: true,
            slots: {
              enabled: <SettingsToggle disabled />,
              frequencyInfo: info('ai.cut.freq_desc'),
              frequency: null,
              sourcesInfo: info('ai.cut.source_dep_desc'),
              sources: (
                <View style={{ gap: 12, marginVertical: 8 }}>
                  {['share_screen', 'share_todo', 'share_time'].map((key) => (
                    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <IconOutline name="border" color="#777" />
                      <Text style={{ color: '#777' }}>{t(`ai.cut.${key}`)}</Text>
                    </View>
                  ))}
                </View>
              ),
              extractionInfo: info('ai.cut.extraction.desc'),
              extraction: (
                <SettingsChoice
                  disabled
                  options={['easy', 'medium', 'max'].map((value) => ({
                    value,
                    label: t(`ai.cut.extraction.${value}`),
                  }))}
                />
              ),
              blurInfo: info('ai.cut.blur.desc'),
              blur: <SettingsToggle disabled />,
            },
          }),
          save: (
            <Button tone="primary" disabled>
              {t('settings.ai.update.save')}
            </Button>
          ),
          deployment: AIDeploymentContent({
            ...common,
            verified: false,
            owner: false,
            changed: false,
            slots: {
              token: (
                <Input
                  value=""
                  disabled
                  secure
                  placeholder={t('settings.ai.precheck.placeholder')}
                  onChangeText={() => {}}
                />
              ),
              verify: (
                <Button tone="primary" disabled>
                  {t('settings.ai.precheck.check')}
                </Button>
              ),
              model: null,
              key: null,
              url: null,
              enabled: null,
              save: null,
            },
          }),
        },
      })}
      <SettingsNote>{t('native_settings.unavailable')}</SettingsNote>
    </>
  );
}
