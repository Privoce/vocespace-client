import { useI18n } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { VideoView } from 'expo-video';
import { useSpacePreview } from '../conference/hooks/useSpacePreview';
import type { useConference } from '../conference/hooks/useConference';
import type { LocalSettings } from '../settings/model';
import { FlatList, Text, View } from 'react-native';
import type { useSpaceBrowser } from '../conference/hooks/useSpaceBrowser';
import { PrimaryButton } from '../ui/controls';
import { colors, ui } from '../theme';
/** Controlled directory browsing. No synthetic video or implicit membership while scrolling. */
export function SpaceBrowser({
  browser,
  join,
  busy,
  joinError,
  model,
  preferences,
  preferencesReady,
}: {
  browser: ReturnType<typeof useSpaceBrowser>;
  join: (name: string) => Promise<void>;
  model: ReturnType<typeof useConference>;
  preferences: LocalSettings;
  preferencesReady: boolean;
  busy: boolean;
  joinError?: string;
}) {
  const { t } = useI18n();
  const [height, setHeight] = useState(0);
  const [dragging, setDragging] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const offset = useRef(0);
  const preview = useSpacePreview({
    model,
    space: browser.spaces[browser.index]?.name,
    active: !dragging && !busy && preferencesReady && !!height,
    preferences,
    join,
    });
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  const settle = () => {
    clearTimeout(settleTimer.current);
    if (!height || Math.abs(offset.current / height - Math.round(offset.current / height)) > 0.1)
      return;
    browser.setIndex(
      Math.max(0, Math.min(browser.spaces.length - 1, Math.round(offset.current / height))),
    );
    setDragging(false);
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, gap: 8 }}>
        <Text style={ui.subtitle}>{t('native_navigation.title')}</Text>
        {joinError && (
          <Text accessibilityRole="alert" style={ui.body}>
            {joinError}
          </Text>
        )}
        {browser.error && (
          <Text style={ui.body}>
            {t('native_navigation.error')} {browser.error}
          </Text>
        )}
        <PrimaryButton size="small" onPress={browser.refresh}>
          {t('native_navigation.refresh')}
        </PrimaryButton>
      </View>
      <View style={{ flex: 1 }} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        {!!height && (
          <FlatList
            key={height}
            data={browser.spaces}
            pagingEnabled
            initialScrollIndex={browser.spaces.length ? browser.index : undefined}
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            keyExtractor={(item) => item.name}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              offset.current = event.nativeEvent.contentOffset.y;
            }}
            onScrollBeginDrag={() => {
              clearTimeout(settleTimer.current);
              preview.cancel();
              setDragging(true);
            }}
            onMomentumScrollBegin={() => clearTimeout(settleTimer.current)}
            onScrollEndDrag={() => {
              settleTimer.current = setTimeout(settle, 350);
            }}
            onMomentumScrollEnd={(event) => {
              offset.current = event.nativeEvent.contentOffset.y;
              settle();
            }}
            ListEmptyComponent={
              <Text style={[ui.body, { padding: 24 }]}>{t('native_navigation.empty')}</Text>
            }
            renderItem={({ item, index }) => (
              <View style={{ height, padding: 16, gap: 8 }}>
                <Text style={{ color: colors.accent }}>
                  {index + 1} / {browser.spaces.length}
                </Text>
                <Text style={ui.title}>{item.name}</Text>
                <Text style={ui.body}>
                  {item.participantCount} {t('native_navigation.members')} · {item.roomCount}{' '}
                  {t('native_navigation.rooms')}
                </Text>
                {index === browser.index && !dragging && (
                  <View
                    style={{
                      flex: 1,
                      minHeight: 100,
                      backgroundColor: colors.surface,
                      borderRadius: 16,
                      overflow: 'hidden',
                    }}
                  >
                    <VideoView
                      key={item.name}
                      player={preview.player}
                      style={{ flex: 1 }}
                      nativeControls={false}
                      contentFit="contain"
                      allowsPictureInPicture={false}
                      onFirstFrameRender={preview.firstFrame}
                    />
                  </View>
                )}
                <Text style={ui.body}>{t('native_navigation.preview_notice')}</Text>
                {index === browser.index && (
                  <Text style={ui.body} accessibilityLiveRegion="polite">
                    {preview.availability === 'error'
                      ? t('native_navigation.preview_error')
                      : preview.availability === 'unavailable'
                        ? t('native_navigation.preview_unavailable')
                        : preview.state.phase === 'playing'
                          ? preferences.autoJoin
                            ? `${Math.ceil(preview.state.remainingMs / 1000)} ${t('native_navigation.join_countdown')}`
                            : t('native_navigation.manual_only')
                          : t('native_navigation.preview_loading')}
                  </Text>
                )}
                {index === browser.index && preview.availability === 'error' && (
                  <PrimaryButton size="small" onPress={preview.retry}>
                    {t('native_settings.retry')}
                  </PrimaryButton>
                )}

                <PrimaryButton
                  disabled={
                    busy || dragging || index !== browser.index || preview.state.phase === 'joining'
                  }
                  onPress={preview.join}
                >
                  {t('native_navigation.join')}
                </PrimaryButton>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
