import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MeetingButton, MeetingIcon } from '../../ui/meeting';
import { View, PanResponder, Modal, Text } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import * as Crypto from 'expo-crypto';
import type { NativeRoom } from '../room';
import type { useConferenceChat } from '../../chat/hooks/useConferenceChat';

type Stroke = { id: string; color: string; points: { x: number; y: number }[] };
export function Whiteboard({
  id,
  room,
  chat,
  onError,
  open,
  onClose,
  t,
}: {
  id: string;
  room: NativeRoom;
  chat: ReturnType<typeof useConferenceChat>;
  onError: () => void;
  open: boolean;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [drawings, setDrawings] = useState<Record<string, Stroke[]>>({});
  const own = useRef<Stroke[]>([]);
  const current = useRef<Stroke | undefined>(undefined);
  const size = useRef({ width: 1, height: 1 });
  const [dimensions, setDimensions] = useState(size.current);
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
        const valid = strokes.filter(
          (s): s is Stroke =>
            s &&
            typeof s.id === 'string' &&
            typeof s.color === 'string' &&
            /^#[\da-f]{6}$/i.test(s.color) &&
            Array.isArray(s.points) &&
            s.points.length <= 2000 &&
            s.points.every(
              (p: { x: number; y: number }) =>
                p &&
                Number.isFinite(p.x) &&
                Number.isFinite(p.y) &&
                p.x >= 0 &&
                p.x <= 1 &&
                p.y >= 0 &&
                p.y <= 1,
            ),
        );
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
        current.current = { id: Crypto.randomUUID(), color: '#22ccee', points: [] };
        update(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
      onPanResponderMove: (e) => update(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  });
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#171f25' }}>
        <View
          style={{
            flexDirection: 'row',
            padding: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: '#ddd', fontSize: 16 }}>{t('common.whiteboard.title')}</Text>
          <MeetingButton appearance="icon" label={t('common.close')} onPress={onClose}>
            <MeetingIcon name="close" />
          </MeetingButton>
        </View>
        <View
          style={{ flex: 1, backgroundColor: '#202020' }}
          onLayout={(e) => {
            size.current = e.nativeEvent.layout;
            setDimensions(e.nativeEvent.layout);
          }}
          {...pan.panHandlers}
        >
          <Svg width="100%" height="100%" pointerEvents="none">
            {Object.entries(drawings).flatMap(([sender, strokes]) =>
              strokes.map((s) => (
                <Polyline
                  key={`${sender}:${s.id}`}
                  points={s.points
                    .map((p) => `${p.x * dimensions.width},${p.y * dimensions.height}`)
                    .join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )),
            )}
          </Svg>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
