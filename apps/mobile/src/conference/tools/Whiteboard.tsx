import { parseWhiteboardStrokes, type WhiteboardStroke } from '@vocespace/contracts';
import { useEffect, useRef, useState } from 'react';
import { View, PanResponder, Pressable, ScrollView, StyleSheet } from 'react-native';
import { IconOutline, type OutlineGlyphMapType } from '@ant-design/icons-react-native';
import Svg, { Polyline } from 'react-native-svg';
import * as Crypto from 'expo-crypto';
import type { NativeRoom } from '../room';
import type { useConferenceChat } from '../../chat/hooks/useConferenceChat';
import { eraseWhiteboardStrokes } from './whiteboard-drawing';

type Stroke = WhiteboardStroke;
export function Whiteboard({
  id,
  room,
  chat,
  onError,
  t,
  onDrawingChange,
}: {
  id: string;
  room: NativeRoom;
  chat: ReturnType<typeof useConferenceChat>;
  onError: () => void;
  t: (key: string) => string;
  onDrawingChange: (drawing: boolean) => void;
}) {
  const [drawings, setDrawings] = useState<Record<string, Stroke[]>>({});
  const [expanded, setExpanded] = useState(true);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#22ccee');
  const [width, setWidth] = useState(0.006);
  const own = useRef<Stroke[]>([]);
  const undo = useRef<Stroke[][]>([]);
  const redo = useRef<Stroke[][]>([]);
  const current = useRef<Stroke | undefined>(undefined);
  const beforeGesture = useRef<Stroke[]>([]);
  const size = useRef({ width: 1, height: 1 });
  const latest = useRef({ onError, onDrawingChange, tool, color, width });
  latest.current = { onError, onDrawingChange, tool, color, width };
  const sync = useRef<(() => void) | undefined>(undefined);
  const renderLocal = () => setDrawings((d) => ({ ...d, local: [...own.current] }));
  const changed = () => {
    renderLocal();
    sync.current?.();
  };
  // Serialize snapshots: an older slow request must not overwrite a newer undo/clear.
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sending = false;
    let dirty = false;
    const flush = async () => {
      if (sending || controller.signal.aborted) return;
      sending = true;
      try {
        while (dirty && !controller.signal.aborted) {
          dirty = false;
          await room.tools(
            { action: 'whiteboard', playerId: id, handWriting: { strokes: own.current } },
            controller.signal,
          );
        }
      } catch {
        if (!controller.signal.aborted) latest.current.onError();
      } finally {
        sending = false;
      }
    };
    sync.current = () => {
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), 100);
    };
    return () => {
      controller.abort();
      clearTimeout(timer);
      sync.current = undefined;
      latest.current.onDrawingChange(false);
    };
  }, [room, id]);
  useEffect(
    () =>
      chat.onControl((event, value) => {
        if (!value || typeof value !== 'object') return;
        const data = value as Record<string, unknown>;
        if (data.receiverId !== id || data.space !== room.raw.name) return;
        if (event === 'whiteboard_clear') {
          own.current = [];
          undo.current = [];
          redo.current = [];
          current.current = undefined;
          setDrawings({});
          return;
        }
        const directory = room.getDirectory();
        const ids = directory?.rooms.find((r) => r.name === directory.current)?.participantIds;
        if (
          event !== 'whiteboard' ||
          typeof data.senderId !== 'string' ||
          !ids?.includes(data.senderId)
        )
          return;
        if (data.senderId === room.raw.localParticipant.identity) return;
        try {
          const strokes = parseWhiteboardStrokes(
            (data.handWriting as { strokes?: unknown })?.strokes,
          );
          setDrawings((d) => ({ ...d, [data.senderId as string]: strokes }));
        } catch {
          /* Ignore malformed remote drawings. */
        }
      }),
    [chat.onControl, id, room],
  );
  const [pan] = useState(() => {
    const update = (x: number, y: number) => {
      if (latest.current.tool === 'eraser') {
        own.current = eraseWhiteboardStrokes(
          own.current,
          x,
          y,
          size.current.width,
          size.current.height,
        );
        renderLocal();
        return;
      }
      const stroke = current.current;
      if (!stroke || stroke.points.length >= 2000) return;
      stroke.points.push({
        x: Math.max(0, Math.min(1, x / size.current.width)),
        y: Math.max(0, Math.min(1, y / size.current.height)),
      });
      setDrawings((d) => ({ ...d, local: [...own.current, stroke] }));
    };
    const finish = () => {
      latest.current.onDrawingChange(false);
      if (current.current) own.current = [...own.current, current.current].slice(-100);
      current.current = undefined;
      if (
        own.current.length === beforeGesture.current.length &&
        own.current.every((s, i) => s === beforeGesture.current[i])
      )
        return;
      undo.current = [...undo.current, beforeGesture.current].slice(-30);
      redo.current = [];
      changed();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        latest.current.onDrawingChange(true);
        beforeGesture.current = own.current;
        if (latest.current.tool === 'pen')
          current.current = {
            id: Crypto.randomUUID(),
            color: latest.current.color,
            width: latest.current.width,
            tool: 'pen',
            createdAt: Date.now(),
            points: [],
          };
        update(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
      onPanResponderMove: (e) => update(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  });
  const action = (
    key: string,
    icon: OutlineGlyphMapType,
    onPress: () => void,
    active = false,
    disabled = false,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={t(`common.whiteboard.${key}`)}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, active && styles.active, disabled && { opacity: 0.3 }]}
    >
      <IconOutline name={icon} size={20} color={active ? '#22ccee' : '#d9e4ea'} />
    </Pressable>
  );
  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        {action(expanded ? 'collapse' : 'expand', expanded ? 'left' : 'edit', () =>
          setExpanded(!expanded),
        )}
        {expanded && (
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tools}
          >
            {action('pen', 'edit', () => setTool('pen'), tool === 'pen')}
            {action('eraser', 'clear', () => setTool('eraser'), tool === 'eraser')}
            {action(
              'undo',
              'undo',
              () => {
                redo.current.push(own.current);
                own.current = undo.current.pop()!;
                changed();
              },
              false,
              !undo.current.length,
            )}
            {action(
              'redo',
              'redo',
              () => {
                undo.current.push(own.current);
                own.current = redo.current.pop()!;
                changed();
              },
              false,
              !redo.current.length,
            )}
            {action(
              'clear_self',
              'delete',
              () => {
                undo.current = [...undo.current, own.current].slice(-30);
                redo.current = [];
                own.current = [];
                changed();
              },
              false,
              !own.current.length,
            )}
            {action(
              'stroke_size',
              'line',
              () => setWidth(width >= 0.012 ? 0.003 : width + 0.003),
              width >= 0.009,
            )}
            {['#22ccee', '#222222', '#ff4d4f', '#52c41a', '#faad14'].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${t('common.whiteboard.color')} ${value}`}
                accessibilityState={{ selected: color === value }}
                onPress={() => {
                  setColor(value);
                  setTool('pen');
                }}
                style={[styles.button, color === value && styles.active]}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: value }} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
      <View
        testID="whiteboard-canvas"
        style={styles.canvas}
        onLayout={(e) => {
          size.current = e.nativeEvent.layout;
        }}
        {...pan.panHandlers}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          pointerEvents="none"
        >
          {Object.entries(drawings).flatMap(([sender, strokes]) =>
            strokes.map((s) => (
              <Polyline
                key={`${sender}:${s.id}`}
                points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )),
          )}
        </Svg>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  toolbar: { flexDirection: 'row', backgroundColor: '#202020', minHeight: 44 },
  tools: { alignItems: 'center', gap: 2 },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  active: { backgroundColor: '#183d48' },
  canvas: { flex: 1, overflow: 'hidden' },
});
