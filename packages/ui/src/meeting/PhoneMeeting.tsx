'use client';
import { MeetingSheet } from './MeetingSheet';
import { Fragment, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
} from 'react-native';
import { meetingColors as c } from '../theme';
import { meetingPageSwipe, type MeetingTile } from '@vocespace/meeting-core';
import { MeetingLayoutSwitch, MeetingPagination } from './MeetingLayoutControls';
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
  onLowerHand,
  handLabel,
  lowerHandLabel,
  renderTileActions,
  onFocusedChange,
  onMemberLongPress,
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
  );
  const { layout, size, viewport } = model;
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    onFocusedChange?.(model.explicitlyFocused);
  }, [model.explicitlyFocused, onFocusedChange]);
  const pan = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (event, gesture) => {
      const capture =
        !fullscreenTileId &&
        !anyPanel &&
        layout.pages > 1 &&
        gesture.numberActiveTouches === 1 &&
        Math.abs(gesture.dx) > 16 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      // PanResponder resets dx/dy when granted. Include the initial movement for quick flicks.
      if (capture)
        swipeOrigin.current = {
          x: event.nativeEvent.pageX - gesture.dx,
          y: event.nativeEvent.pageY - gesture.dy,
        };
      return capture;
    },
    onPanResponderStart: (_, gesture) => {
      if (gesture.numberActiveTouches !== 1) swipeOrigin.current = null;
    },
    onPanResponderRelease: (event) => {
      const origin = swipeOrigin.current;
      swipeOrigin.current = null;
      if (!origin) return;
      const direction = meetingPageSwipe(
        event.nativeEvent.pageX - origin.x,
        event.nativeEvent.pageY - origin.y,
      );
      if (direction)
        model.setPage(Math.max(0, Math.min(layout.pages - 1, layout.page + direction)));
    },
    onPanResponderTerminate: () => {
      swipeOrigin.current = null;
    },
    onPanResponderTerminationRequest: () => true,
  });
  const chatPanel = chat && { ...chat, title: labels.chat, variant: undefined };
  const panels = [chatPanel, panel].filter((item) => !!item);
  const anyPanel = panels.some((item) => item.open);
  function tile(item: MeetingTile, focus = false) {
    const rail = !!layout.focus && !focus;
    const toggleFocus = () => {
      onFocusTrack?.();
      model.setPinned(focus ? null : item.id);
    };
    return (
      <MeetingTileView
        key={item.id}
        item={item}
        onLongPress={!item.local && onMemberLongPress ? () => onMemberLongPress(item) : undefined}
        rail={rail}
        Icon={Icon}
        width={focus || tiles.length + extraTiles.length === 1 ? '100%' : '48.5%'}
        height={
          fullscreenTileId === item.id
            ? Math.max(220, viewport.height - 16)
            : focus
              ? size.focusHeight
              : rail
                ? size.railHeight
                : size.height
        }
        handLabel={item.local ? lowerHandLabel : handLabel}
        onLowerHand={item.local && onLowerHand ? () => onLowerHand(item) : undefined}
        avatar={renderAvatar?.(item, false)}
        actions={
          rail && Icon ? (
            <Button appearance="icon" label={`${labels.focus} ${item.name}`} onPress={toggleFocus}>
              <Icon name="focus" size={18} color="#ADC1CD" />
            </Button>
          ) : (
            renderTileActions?.(item, focus, toggleFocus)
          )
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
          <MeetingLayoutSwitch
            labels={labels}
            Icon={Icon}
            focused={!!layout.focus}
            disabled={!tiles.length && !extraTiles.length}
            onChange={(focus) => {
              onFocusTrack?.();
              model.setPinned(
                focus
                  ? layout.focus?.id ||
                      layout.tiles[0]?.id ||
                      tiles[0]?.id ||
                      extraTiles[0]?.id ||
                      null
                  : null,
              );
            }}
          />
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
        <View style={styles.flex} {...pan.panHandlers} testID="meeting-stage">
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.stage}
            keyboardShouldPersistTaps="handled"
            onLayout={(event) =>
              model.measure(event.nativeEvent.layout.width, event.nativeEvent.layout.height)
            }
          >
            {notice}
            {!tiles.length && !extraTiles.length && (
              <Text style={styles.muted}>{labels.empty}</Text>
            )}
            <View style={styles.grid}>
              {/* Stable keyed siblings keep embedded players mounted when paging/focusing. */}
              {[
                ...(layout.focus ? [layout.focus.id] : []),
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
                if (!extra) {
                  const item = tiles.find((item) => item.id === id)!;
                  return fullscreenTileId && fullscreenTileId !== id
                    ? null
                    : tile(item, layout.focus?.id === id);
                }
                const focus = layout.focus?.id === id;
                return (
                  <View
                    key={id}
                    pointerEvents={
                      !focus && !layout.tiles.some((item) => item.id === id) ? 'none' : 'auto'
                    }
                    accessibilityElementsHidden={
                      !focus && !layout.tiles.some((item) => item.id === id)
                    }
                    importantForAccessibility={
                      !focus && !layout.tiles.some((item) => item.id === id)
                        ? 'no-hide-descendants'
                        : 'auto'
                    }
                    style={[
                      {
                        width: focus || tiles.length + extraTiles.length === 1 ? '100%' : '48.5%',
                        height: focus
                          ? size.focusHeight
                          : layout.focus
                            ? size.railHeight
                            : size.height,
                        overflow: 'hidden',
                        borderRadius: 14,
                      },
                      ((!focus && !layout.tiles.some((item) => item.id === id)) ||
                        (!!fullscreenTileId && fullscreenTileId !== id)) &&
                        styles.hidden,
                    ]}
                  >
                    {extra.content}
                  </View>
                );
              })}
            </View>
          </ScrollView>
          {!fullscreenTileId && (
            <MeetingPagination
              labels={labels}
              Icon={Icon}
              page={layout.page}
              pages={layout.pages}
              onChange={model.setPage}
            />
          )}
        </View>
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    flexWrap: 'wrap',
  },
  identity: { flex: 1, minWidth: 64, gap: 6 },
  title: { color: '#F1F5FB', fontSize: 16, fontWeight: '700' },
  muted: { color: '#96A5BB', fontSize: 11 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#41D7A0' },
  offline: { backgroundColor: '#E5A54B' },
  stage: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 4, gap: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  hidden:
    Platform.OS === 'web'
      ? { display: 'none' }
      : { position: 'absolute', opacity: 0, zIndex: -1, left: 0, top: 0 },
});
