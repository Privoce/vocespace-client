import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { useLocalSettings } from '../settings/useLocalSettings';
import { colors, ui } from '../theme';
import { Input, Switch } from '../ui/controls';

type SettingsModel = ReturnType<typeof useLocalSettings>;
export function ProfileScreen({ model }: { model: SettingsModel }) {
  const { settings, ready, error, update } = model;
  return (
    <ScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
      <Text style={ui.eyebrow}>MY SPACE</Text>
      <Text style={ui.title}>我的</Text>
      <Text style={ui.body}>以访客身份参与交流。以下偏好仅保存在本机。</Text>
      <View style={ui.card}>
        <Text style={ui.subtitle}>本机昵称</Text>
        <Input
          accessibilityLabel="本机昵称"
          editable={ready}
          value={settings.nickname}
          maxLength={30}
          placeholder="访客"
          placeholderTextColor={colors.muted}
          onChangeText={(nickname) => update({ nickname })}
        />
        <View style={styles.row}>
          <Text style={styles.label}>预览默认静音</Text>
          <Switch
            accessibilityLabel="预览默认静音"
            disabled={!ready}
            checked={settings.previewMuted}
            trackColor={{ true: colors.accent }}
            onChange={(previewMuted) => update({ previewMuted })}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>停留后自动加入</Text>
          <Switch
            accessibilityLabel="停留后自动加入"
            disabled={!ready}
            checked={settings.autoJoin}
            trackColor={{ true: colors.accent }}
            onChange={(autoJoin) => update({ autoJoin })}
          />
        </View>
        <Text style={ui.body}>
          预览功能开放后，在支持预览的会议中停留 10 秒，且正常播放至少 5
          秒，才会自动加入。不会自动打开麦克风或摄像头。
        </Text>
        {!ready && <Text style={ui.body}>正在读取设置…</Text>}
        {error && (
          <Text accessibilityRole="alert" style={ui.body}>
            {error}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.text, fontSize: 16, flexShrink: 1 },
});
