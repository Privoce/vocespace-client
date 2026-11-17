import { parseWhiteboardStrokes, type WhiteboardStroke } from '@vocespace/contracts';
import { useEffect, useRef, useState } from 'react';
import { View, PanResponder } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import * as Crypto from 'expo-crypto';
import type { NativeRoom } from '../room';
import type { useConferenceChat } from '../../chat/hooks/useConferenceChat';

type Stroke = WhiteboardStroke;
export function Whiteboard({
  id,
  room,
  chat,
  onError,
}: {
  id: string;
  room: NativeRoom;
  chat: ReturnType<typeof useConferenceChat>;
  onError: () => void;
}) {
  const [drawings, setDrawings] = useState<Record<string, Stroke[]>>({});
  const own = useRef<Stroke[]>([]);
  const current = useRef<Stroke | undefined>(undefined);
  const size = useRef({ width: 1, height: 1 });
  const latest = useRef({ room, onError });
  latest.current = { room, onError };
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void room
        .tools(
          { action: 'whiteboard', playerId: id, handWriting: { strokes: own.current } },
          controller.signal,
        )
        .catch(() => {
          if (!controller.signal.aborted) latest.current.onError();
        });
    }, 100);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pending, room, id]);
  useEffect(
    () =>
      chat.onControl((event, value) => {
        if (!value || typeof value !== 'object') return;
        const data = value as Record<string, unknown>;
        if (data.receiverId !== id || data.space !== room.raw.name) return;
        const directory = room.getDirectory();
        const ids = directory?.rooms.find((r) => r.name === directory.current)?.participantIds;
        if (event === 'whiteboard_clear') {
          own.current = [];
          current.current = undefined;
          setDrawings({});
          return;
        }
        if (
          event !== 'whiteboard' ||
          typeof data.senderId !== 'string' ||
          !ids?.includes(data.senderId)
        )
          return;
        if (data.senderId === room.raw.localParticipant.identity) return;
        const strokes = (data.handWriting as { strokes?: unknown })?.strokes;
        if (!Array.isArray(strokes) || strokes.length > 200) return;
        let valid: Stroke[];
        try {
          valid = parseWhiteboardStrokes(strokes);
        } catch {
          return;
        }
        setDrawings((d) => ({ ...d, [data.senderId as string]: valid }));
      }),
    [chat.onControl, id, room],
  );
  const [pan] = useState(() => {
    const update = (x: number, y: number) => {
      const stroke = current.current;
      if (!stroke || stroke.points.length >= 2000) return;
      stroke.points.push({
        x: Math.max(0, Math.min(1, x / size.current.width)),
        y: Math.max(0, Math.min(1, y / size.current.height)),
      });
      setDrawings((d) => ({ ...d, local: [...own.current, stroke] }));
    };
    const finish = () => {
      if (!current.current) return;
      own.current = [...own.current, current.current].slice(-100);
      current.current = undefined;
      setPending((n) => n + 1);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        current.current = {
          id: Crypto.randomUUID(),
          color: '#22ccee',
          points: [],
          width: 0.006,
          tool: 'pen',
          createdAt: Date.now(),
        };
        update(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
      onPanResponderMove: (e) => update(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  });
  return (
    <View
      style={{ flex: 1, backgroundColor: '#ffffff' }}
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
  );
}
