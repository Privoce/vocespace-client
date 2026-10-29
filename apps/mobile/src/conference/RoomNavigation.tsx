import { navigationGesture } from './navigation-gesture';
import { useRef, useState, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';
import type { NativeRoomDirectory } from '@vocespace/contracts';
import type { useConference } from './hooks/useConference';
/** Gesture changes use the same guarded exit path as explicit navigation. */
export function RoomNavigation({
  conference,
  directory,
  enabled,
  allowRoomSwipe = true,
  onBrowse,
  children,
}: {
  conference: ReturnType<typeof useConference>;
  directory?: NativeRoomDirectory;
  enabled: boolean;
  allowRoomSwipe?: boolean;
  onBrowse?: (direction: number) => Promise<void>;
  children: (navigation: { move: (name: string) => Promise<void>; busy: boolean }) => ReactNode;
}) {
  const flight = useRef(false);
  const [busy, setBusy] = useState(false);
  const current = directory?.rooms.findIndex((room) => room.name === directory.current) ?? -1;
  const move = async (name: string) => {
    if (flight.current || name === directory?.current) return;
    const space = conference.state.spaceName;
    const nickname = conference.state.joined?.participantName;
    if (!space || !nickname) return;
    flight.current = true;
    setBusy(true);
    try {
      if (await conference.leave())
        await conference.join(space, nickname, name === space ? undefined : name, false, { source: 'room_switch', switchFrom: conference.state.joined?.childRoom ? 'child' : 'main' });
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  const pan = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      const navigation = navigationGesture(gesture.dx, gesture.dy);
      return (
        enabled &&
        !busy &&
        !flight.current &&
        gesture.numberActiveTouches === 1 &&
        !!navigation &&
        (navigation.axis === 'room' ? allowRoomSwipe : !!onBrowse)
      );
    },
    onPanResponderRelease: (_, gesture) => {
      if (flight.current || !enabled) return;
      const navigation = navigationGesture(gesture.dx, gesture.dy);
      if (navigation?.axis === 'room' && allowRoomSwipe) {
        const room = directory?.rooms[current + navigation.direction];
        if (room) void move(room.name);
      } else if (navigation?.axis === 'space') void onBrowse?.(navigation.direction);
    },
    onPanResponderTerminationRequest: () => true,
  });
  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      {children({ move, busy })}
    </View>
  );
}
