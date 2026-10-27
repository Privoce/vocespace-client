import { useI18n } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { VideoView } from 'expo-video';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSpacePreview } from '../conference/hooks/useSpacePreview';
import { PREVIEW_JOIN_DELAY_MS } from '../conference/preview-controller';
import type { useConference } from '../conference/hooks/useConference';
import type { LocalSettings } from '../settings/model';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { useSpaceBrowser } from '../conference/hooks/useSpaceBrowser';
import { IconOutline, PrimaryButton } from '../ui/controls';
import { palette as c } from './meetings/styles';
import { RoomIllustration } from './meetings/RoomIllustration';
/** Only the settled card owns an HLS preview; directory browsing never creates RTC membership. */
export function SpaceBrowser({
  browser,
  join,
  busy,
  joinError,
  model,
  preferences,
  preferencesReady,
  active,
  onPreferences,
}: {
  browser: ReturnType<typeof useSpaceBrowser>;
  join: (name: string) => Promise<void>;
  model: ReturnType<typeof useConference>;
  preferences: LocalSettings;
  preferencesReady: boolean;
  active: boolean;
  onPreferences: (patch: Partial<LocalSettings>) => void;
  busy: boolean;
  joinError?: string;
}) {
  const { t } = useI18n();
  const text = (key: string) => t(`meeting_tab.${key}`);
  const [height, setHeight] = useState(0);
  const [dragging, setDragging] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const offset = useRef(0);
  const preview = useSpacePreview({
    model,
    space: browser.spaces[browser.index]?.name,
    active: active && !dragging && !busy && preferencesReady && !!height,
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
  const playing = preview.state.phase === 'playing';
  const countdown = playing && preferences.autoJoin;
  const status =
    preview.availability === 'error'
      ? t('native_navigation.preview_error')
      : preview.availability === 'unavailable'
        ? t('native_navigation.preview_unavailable')
        : playing
          ? text('live')
          : t('native_navigation.preview_loading');
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {(joinError || browser.error) && (
        <View style={{ padding: 12 }}>
          <Text accessibilityRole="alert" style={s.muted}>
            {joinError || t('native_navigation.error')}
          </Text>
          <PrimaryButton type="ghost" size="small" onPress={browser.refresh}>
            {t('native_settings.retry')}
          </PrimaryButton>
        </View>
      )}
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
              <View
                style={{
                  height,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 18,
                  padding: 24,
                }}
              >
                <RoomIllustration kind="meeting" size={140} />
                <Text style={s.muted}>{t('native_navigation.empty')}</Text>
                <PrimaryButton type="ghost" onPress={browser.refresh}>
                  {t('native_navigation.refresh')}
                </PrimaryButton>
              </View>
            }
            renderItem={({ item, index }) => {
              const selected = index === browser.index;
              return (
                <View style={{ height, paddingHorizontal: 12, paddingBottom: 8 }}>
                  <View style={s.card}>
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { alignItems: 'center', justifyContent: 'center', paddingBottom: 180 },
                      ]}
                    >
                      <RoomIllustration kind="meeting" size={180} />
                    </View>
                    {selected && active && !dragging && (
                      <VideoView
                        key={item.name}
                        player={preview.player}
                        style={[
                          StyleSheet.absoluteFill,
                          { opacity: preview.availability === 'ready' ? 1 : 0 },
                        ]}
                        nativeControls={false}
                        contentFit="cover"
                        allowsPictureInPicture={false}
                        onFirstFrameRender={preview.firstFrame}
                      />
                    )}
                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <Svg width="100%" height="100%">
                        <Defs>
                          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={c.background} stopOpacity={0.08} />
                            <Stop offset="0.4" stopColor={c.background} stopOpacity={0.05} />
                            <Stop offset="0.65" stopColor={c.background} stopOpacity={0.7} />
                            <Stop offset="1" stopColor={c.background} stopOpacity={0.99} />
                          </LinearGradient>
                        </Defs>
                        <Rect width="100%" height="100%" fill="url(#shade)" />
                      </Svg>
                    </View>
                    <View style={s.cardTop}>
                      <View style={s.pill}>
                        <View
                          style={[
                            s.dot,
                            { backgroundColor: selected && playing ? c.green : c.muted },
                          ]}
                        />
                        <Text style={s.pillText}>
                          {selected && playing ? text('live') : text('preview')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <Text style={s.pageNumber}>
                        {String(index + 1).padStart(2, '0')}{' '}
                        <Text style={{ color: '#9AB0BD' }}>
                          / {String(browser.spaces.length).padStart(2, '0')}
                        </Text>
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('native_navigation.refresh')}
                        style={s.refresh}
                        onPress={browser.refresh}
                      >
                        <IconOutline name="reload" size={15} color={c.text} />
                      </Pressable>
                    </View>
                    <View style={s.info}>
                      <View
                        style={{
                          alignSelf: 'flex-end',
                          alignItems: 'center',
                          gap: 4,
                          marginBottom: 12,
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={text(preferences.previewMuted ? 'unmute' : 'mute')}
                          onPress={() => onPreferences({ previewMuted: !preferences.previewMuted })}
                          style={s.mute}
                        >
                          <IconOutline
                            name={preferences.previewMuted ? 'sound' : 'audio'}
                            size={22}
                            color={c.text}
                          />
                          {preferences.previewMuted && <View style={s.slash} />}
                        </Pressable>
                        <Text style={[s.muted, { fontSize: 9 }]}>
                          {text(preferences.previewMuted ? 'muted' : 'sound_on')}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                        <View style={s.spaceIcon}>
                          <IconOutline name="team" size={18} color="#16404B" />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={{ color: c.text, fontSize: 12, flexShrink: 1 }}
                        >
                          {item.name}
                        </Text>
                        <Text style={s.tag}>SPACE</Text>
                      </View>
                      <Text numberOfLines={2} style={s.title}>
                        {item.name}
                      </Text>
                      <Text style={s.muted}>{text('preview_hint')}</Text>
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}
                      >
                        <IconOutline name="team" size={13} color={c.muted} />
                        <Text style={s.stats}>
                          {item.participantCount} {text('online')} · {item.roomCount} Room
                        </Text>
                      </View>
                      {selected && !playing && (
                        <Text accessibilityLiveRegion="polite" style={[s.muted, { fontSize: 10 }]}>
                          {status}
                        </Text>
                      )}
                      {selected && preview.availability === 'error' && (
                        <Pressable
                          onPress={preview.retry}
                          accessibilityRole="button"
                          style={{ minHeight: 32, justifyContent: 'center' }}
                        >
                          <Text style={{ color: c.accent }}>{t('native_settings.retry')}</Text>
                        </Pressable>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={text('join')}
                        disabled={
                          !active ||
                          busy ||
                          dragging ||
                          !selected ||
                          preview.state.phase === 'joining'
                        }
                        onPress={preview.join}
                        style={({ pressed }) => [
                          s.join,
                          pressed && { backgroundColor: '#245061' },
                          (!active || busy || dragging || !selected) && { opacity: 0.5 },
                        ]}
                      >
                        {selected && countdown && (
                          <View
                            style={[
                              s.progress,
                              {
                                width: `${Math.min(100, Math.max(0, (1 - preview.state.remainingMs / PREVIEW_JOIN_DELAY_MS) * 100))}%`,
                              },
                            ]}
                          />
                        )}
                        <Text style={s.joinText}>{text('join')}</Text>
                        <View style={{ flex: 1 }} />
                        {selected && countdown && (
                          <Text style={{ color: c.accent, fontWeight: '700', fontSize: 18 }}>
                            {Math.ceil(preview.state.remainingMs / 1000)}
                            <Text style={{ fontSize: 11 }}> s</Text>
                          </Text>
                        )}
                        <IconOutline name="arrow-right" size={16} color="#C1E1EB" />
                      </Pressable>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 4,
                        }}
                      >
                        <Text style={s.footnote}>
                          {preferences.autoJoin
                            ? text('auto_hint')
                            : t('native_navigation.manual_only')}
                        </Text>
                        <Text style={s.footnote}>⌃ {text('swipe')}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#213B48',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#304854',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#142731A8',
    borderRadius: 4,
    padding: 6,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { color: c.text, fontSize: 9 },
  pageNumber: { color: '#fff', fontSize: 11 },
  refresh: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  info: { position: 'absolute', bottom: 18, left: 20, right: 20, gap: 12 },
  spaceIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#A1D9DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: c.text, fontSize: 24, fontWeight: '700', lineHeight: 32 },
  tag: {
    color: '#BDD0D9',
    letterSpacing: 1.5,
    borderWidth: 1,
    borderColor: '#6D8791',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontSize: 8,
  },
  muted: { color: '#9BB2BF', fontSize: 12, lineHeight: 19 },
  stats: { color: c.muted, fontSize: 10 },
  mute: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#294350BB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slash: {
    position: 'absolute',
    height: 2,
    width: 24,
    backgroundColor: c.text,
    transform: [{ rotate: '45deg' }],
  },
  join: {
    minHeight: 56,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: c.accent,
    backgroundColor: '#142F3AEF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  joinText: { color: '#E3F5FA', fontSize: 16, fontWeight: '600' },
  progress: { position: 'absolute', top: 0, left: 0, height: 3, backgroundColor: c.accent },
  footnote: { color: c.muted, fontSize: 9, lineHeight: 16 },
});
