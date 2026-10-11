import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeParticipantApps } from '@vocespace/contracts';
import { useI18n } from '../i18n';
import { ui } from '../theme';
export function ParticipantApps({ apps }: { apps?: NativeParticipantApps }) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const time = (value: number) => {
    const seconds = Math.floor(Math.max(0, value) / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  };
  return (
    <ScrollView contentContainerStyle={ui.page}>
      <Text style={ui.body}>{t('more.app.settings.sync.read')}</Text>
      {apps?.todo && (
        <View style={ui.card}>
          <Text style={ui.subtitle}>{t('more.app.todo.title')}</Text>
          {apps.todo.map((item) => (
            <Text
              key={item.id}
              style={[ui.body, item.done && { textDecorationLine: 'line-through' }]}
            >
              {item.title}
            </Text>
          ))}
        </View>
      )}
      {apps?.timer && (
        <View style={ui.card}>
          <Text style={ui.subtitle}>{t('more.app.timer.title')}</Text>
          <Text style={ui.title}>
            {time(
              apps.timer.value === null
                ? 0
                : (apps.timer.running ? now : apps.timer.stopTimeStamp || now) - apps.timer.value,
            )}
          </Text>
          {apps.timer.records.map((value, index) => (
            <Text key={index} style={ui.body}>
              {value}
            </Text>
          ))}
        </View>
      )}
      {apps?.countdown && (
        <View style={ui.card}>
          <Text style={ui.subtitle}>{t('more.app.countdown.title')}</Text>
          <Text style={ui.title}>
            {time(
              apps.countdown.value === null
                ? 0
                : apps.countdown.value -
                    (apps.countdown.running ? now : apps.countdown.stopTimeStamp || now),
            )}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
