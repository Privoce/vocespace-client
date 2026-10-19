'use client';
import { MeetingSheet } from './MeetingSheet';
import { Fragment, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { meetingColors as c } from '../theme';
import type { MeetingTile } from '@vocespace/meeting-core';
import { MeetingTileView } from './MeetingTileView';
import { usePhoneMeeting } from './usePhoneMeeting';
import type { PhoneMeetingProps } from './types';

/** Presentation only. Connection owners and platform capabilities stay in the applications. */
export function PhoneMeeting({
  name,
  status,
  connected = true,
  avoidKeyboard = true,
  focusedExtraTile,
  fullscreenTileId,
  onFocusTrack,
  tiles,
  labels,
  Button,
  Icon,
  headerActions,
  leadingAction,
  renderAvatar,
  renderTileActions,
  onFocusedChange,
  renderVideo,
  extraTiles = [],
  controls,
  dock,
  renderSheet,
  notice,
  chat,
  panel,
}: PhoneMeetingProps) {
  const model = usePhoneMeeting(
    [...tiles, ...extraTiles.map((extra) => ({ id: extra.id, name: '' }))],
    fullscreenTileId || focusedExtraTile,
    !!dock,
  );
  const { layout, size, viewport } = model;
  useEffect(() => {
    onFocusedChange?.(model.explicitlyFocused);
  }, [model.explicitlyFocused, onFocusedChange]);
  const chatPanel = chat && { ...chat, title: labels.chat, variant: undefined };
  const panels = [chatPanel, panel].filter((item) => !!item);
  const anyPanel = panels.some((item) => item.open);
  function tile(item: MeetingTile, focus = false) {
    return (
      <MeetingTileView
        key={item.id}
        item={item}
        compact={!!dock && !!layout.focus && !focus}
        Icon={Icon}
        width={
          focus
            ? '100%'
            : viewport.width
              ? size.width
              : layout.tiles.length === 1
                ? '100%'
                : '48.5%'
        }
        height={
          fullscreenTileId === item.id
            ? Math.max(220, viewport.height - 16)
            : dock && layout.focus && !focus
              ? 72
              : viewport.height
                ? Math.max(
                    140,
                    focus
                      ? dock
                        ? Math.max(
                            220,
                            viewport.height -
                              Math.ceil(layout.tiles.length / 2) * 78 -
                              16 -
                              (layout.pages > 1 ? 40 : 0),
                          )
                        : size.focusHeight
                      : size.railHeight || size.height,
                  )
                : 220
        }
        label={`${focus ? labels.unfocus : labels.focus} ${item.name}`}
        onPress={() => {
          onFocusTrack?.();
          model.setPinned(focus ? null : item.id);
        }}
        avatar={renderAvatar?.(item)}
        actions={
          (!dock || focus || !layout.focus) &&
          renderTileActions?.(item, focus, () => {
            onFocusTrack?.();
            model.setPinned(focus ? null : item.id);
          })
        }
        video={item.video ? renderVideo(item.id) : null}
      />
    );
  }
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={avoidKeyboard && Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={styles.flex}
        accessibilityElementsHidden={anyPanel}
        importantForAccessibility={anyPanel ? 'no-hide-descendants' : 'auto'}
      >
        <View style={[styles.header, !!fullscreenTileId && styles.hidden]}>
          {leadingAction && (
            <Button appearance="icon" label={leadingAction.label} onPress={leadingAction.onPress}>
              {Icon ? <Icon name={leadingAction.icon} size={20} /> : leadingAction.label}
            </Button>
          )}
          <View style={styles.identity}>
            <Text numberOfLines={1} style={styles.title}>
              {name}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, !connected && styles.offline]} />
              <Text style={styles.muted} accessibilityLiveRegion="polite">
                {status}
              </Text>
            </View>
          </View>
          {headerActions?.map((action) => (
            <Button
              key={action.id}
              label={action.label}
              appearance="icon"
              onPress={action.onPress}
              disabled={action.disabled}
            >
              {Icon ? <Icon name={action.icon} color="#C6D1E2" size={20} /> : action.label}
            </Button>
          ))}
        </View>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.stage}
          keyboardShouldPersistTaps="handled"
          onLayout={(event) =>
            model.measure(event.nativeEvent.layout.width - 12, event.nativeEvent.layout.height)
          }
        >
          {notice}
          {layout.focus &&
            !extraTiles.some((item) => item.id === layout.focus?.id) &&
            tile(layout.focus, true)}
          {!tiles.length && !extraTiles.length && <Text style={styles.muted}>{labels.empty}</Text>}
          <View style={[styles.grid, !!fullscreenTileId && styles.hidden]}>
            {/* Stable keyed siblings keep embedded players mounted when paging/focusing. */}
            {[
              ...extraTiles
                .filter((extra) => extra.id === layout.focus?.id)
                .map((extra) => extra.id),
              ...layout.tiles.map((item) => item.id),
              ...extraTiles
                .filter(
                  (extra) =>
                    extra.id !== layout.focus?.id &&
                    !layout.tiles.some((item) => item.id === extra.id),
                )
                .map((extra) => extra.id),
            ].map((id) => {
              const extra = extraTiles.find((item) => item.id === id);
              if (!extra) return tile(layout.tiles.find((item) => item.id === id)!);
              const focus = layout.focus?.id === id;
              return (
                <View
                  key={id}
                  style={[
                    {
                      width: focus ? '100%' : viewport.width ? size.width : '48.5%',
                      height: focus
                        ? size.focusHeight
                        : size.railHeight || (viewport.height ? size.height : 220),
                      overflow: 'hidden',
                      borderRadius: 14,
                    },
                    !focus && !layout.tiles.some((item) => item.id === id) && styles.hidden,
                  ]}
                >
                  {extra.content}
                </View>
              );
            })}
          </View>
          {layout.pages > 1 && !fullscreenTileId && (
            <View style={styles.pager}>
              <Button disabled={layout.page === 0} onPress={() => model.setPage(layout.page - 1)}>
                {labels.previous}
              </Button>
              <Text style={styles.muted}>
                {layout.page + 1} / {layout.pages}
              </Text>
              <Button
                disabled={layout.page === layout.pages - 1}
                onPress={() => model.setPage(layout.page + 1)}
              >
                {labels.next}
              </Button>
            </View>
          )}
        </ScrollView>
        <View style={fullscreenTileId ? styles.hidden : undefined}>
          {dock}
          {controls}
        </View>
      </View>
      {panels.map((item, index) => (
        <Fragment key={index}>
          {renderSheet ? (
            renderSheet({ ...item, Button, Icon, closeLabel: labels.close })
          ) : (
            <MeetingSheet {...item} Button={Button} Icon={Icon} closeLabel={labels.close} />
          )}
        </Fragment>
      ))}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', minHeight: 0, backgroundColor: c.background },
  flex: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  identity: { flex: 1, minWidth: 0, gap: 6 },
  title: { color: '#F1F5FB', fontSize: 16, fontWeight: '700' },
  muted: { color: '#96A5BB', fontSize: 11 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#41D7A0' },
  offline: { backgroundColor: '#E5A54B' },
  stage: { paddingHorizontal: 14, paddingBottom: 8, gap: 10 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    rowGap: 6,
  },
  pager: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  sheet: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0C1118', zIndex: 10 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF0D',
  },
  settingsSheet: { backgroundColor: '#111111' },
  settingsHeader: { borderBottomWidth: 0, paddingHorizontal: 24, paddingVertical: 16 },
  hidden: { display: 'none' },
});
