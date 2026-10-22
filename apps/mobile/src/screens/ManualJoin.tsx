import { useI18n } from '../i18n';
import { resolveSpaceInput } from '../conference/space-input';
import { useState } from 'react';
import * as Crypto from 'expo-crypto';
import { ActivityIndicator, Text, View } from 'react-native';
import Checkbox from '@ant-design/react-native/lib/checkbox';
import { spaceEntryContent } from '@vocespace/ui';
import type { useConference } from '../conference/hooks/useConference';
import { meetingFailure } from '../conference/meetingFailure';
import { colors, ui } from '../theme';
import { Input, PrimaryButton } from '../ui/controls';
export function ManualJoin({
  model,
  onJoin,
}: {
  model: ReturnType<typeof useConference>;
  onJoin: (space: string) => void;
}) {
  const { t } = useI18n();
  const [spaceName, setSpaceName] = useState('');
  const [mode, setMode] = useState<'demo' | 'custom'>('demo');
  const [invalid, setInvalid] = useState(false);
  const { state } = model;
  const busy = state.phase === 'joining' || state.phase === 'leaving';
  const submit = () => {
    if (busy || !model.configured || model.hasPendingCleanup) return;
    const random = Crypto.randomUUID().replace(/-/g, '');
    const name =
      mode === 'demo' || !spaceName.trim()
        ? `${random.slice(0, 4)}-${random.slice(4, 8)}`
        : resolveSpaceInput(spaceName, process.env.EXPO_PUBLIC_API_URL);
    if (!name) {
      setInvalid(true);
      return;
    }
    onJoin(name);
  };
  return (
    <View style={{ gap: 16 }}>
      {spaceEntryContent({
        frame: (children) => (
          <View
            style={{
              backgroundColor: '#2c2c2c',
              borderColor: '#333',
              borderWidth: 1,
              borderRadius: 12,
              padding: 20,
              gap: 20,
            }}
          >
            {children}
          </View>
        ),
        tabs: (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#1e1e1e',
              borderRadius: 4,
              padding: 2,
            }}
          >
            {(['demo', 'custom'] as const).map((value) => (
              <View key={value} style={{ flex: 1 }}>
                <PrimaryButton
                  disabled={busy || model.hasPendingCleanup}
                  type={mode === value ? 'primary' : 'ghost'}
                  style={{ borderWidth: 0, borderRadius: 4 }}
                  onPress={() => {
                    setMode(value);
                    setSpaceName('');
                    setInvalid(false);
                  }}
                >
                  {t(`common.${value}`)}
                </PrimaryButton>
              </View>
            ))}
          </View>
        ),
        description: (
          <Text style={[ui.body, { lineHeight: 24 }]}>
            {t(mode === 'demo' ? 'msg.info.try_free' : 'msg.info.try_enter_room')}
          </Text>
        ),
        input: mode === 'custom' && (
          <Input
            accessibilityLabel={t('common.custom')}
            placeholder={t('msg.info.enter_room')}
            value={spaceName}
            onChangeText={(value) => {
              setSpaceName(value);
              setInvalid(false);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy && !model.hasPendingCleanup}
            maxLength={2048}
            onSubmitEditing={submit}
          />
        ),
        submit: (
          <PrimaryButton
            disabled={busy || !model.configured || model.hasPendingCleanup}
            onPress={submit}
          >
            {t('common.start_metting')}
          </PrimaryButton>
        ),
        options: (
          <View style={{ gap: 16 }}>
            <Checkbox disabled checked={false}>
              <Text style={ui.body}>{t('msg.info.enabled_e2ee')}</Text>
            </Checkbox>
            <Checkbox disabled checked={false}>
              <Text style={ui.body}>{t('common.high_quality')}</Text>
            </Checkbox>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {t('native_home.media_options_unavailable')}
            </Text>
          </View>
        ),
      })}
      {!model.configured && <Text style={ui.body}>{t('native_home.unconfigured')}</Text>}
      {invalid && (
        <Text accessibilityRole="alert" style={ui.body}>
          {t('native_home.link_error')}
        </Text>
      )}
      {state.error != null && (
        <Text accessibilityRole="alert" style={ui.body}>
          {meetingFailure(state.error)}
        </Text>
      )}
      {busy && (
        <ActivityIndicator
          color={colors.accent}
          accessibilityLabel={t(
            state.phase === 'leaving' ? 'native_home.leaving' : 'native_home.joining',
          )}
        />
      )}
      {model.hasPendingCleanup && (
        <PrimaryButton
          onPress={() => {
            void model.leave();
          }}
        >
          {t(
            state.phase === 'joining'
              ? 'native_home.cancel'
              : state.phase === 'error'
                ? 'native_home.retry_leave'
                : 'native_home.leave',
          )}
        </PrimaryButton>
      )}
    </View>
  );
}
