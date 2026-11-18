import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({
  pan: {} as Record<string, (...args: any[]) => any>,
  layout: undefined as any,
}));
vi.mock('react-native', () => ({
  View: ({ children, onLayout, testID }: any) => {
    if (onLayout) native.layout = onLayout;
    return <div data-testid={testID}>{children}</div>;
  },
  ScrollView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pressable: ({ children, onPress, disabled, accessibilityLabel }: any) => (
    <button disabled={disabled} aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: unknown) => styles },
  PanResponder: {
    create: (handlers: typeof native.pan) => {
      native.pan = handlers;
      return { panHandlers: {} };
    },
  },
}));
vi.mock('@ant-design/icons-react-native', () => ({ IconOutline: () => null }));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('react-native-svg', () => ({
  default: ({ children }: any) => <svg>{children}</svg>,
  Polyline: (props: any) => <polyline {...props} />,
}));
import { Whiteboard } from '../src/conference/tools/Whiteboard';
import { eraseWhiteboardStrokes } from '../src/conference/tools/whiteboard-drawing';
const t = (key: string) => key;
const request = vi.fn();
const onDrawing = vi.fn();
const room = {
  tools: request,
  raw: { name: 'demo', localParticipant: { identity: 'me' } },
  getDirectory: () => ({
    current: 'demo',
    rooms: [{ name: 'demo', participantIds: ['me', 'other'] }],
  }),
} as any;
let receive: (event: string, value: unknown) => void;
const chat = {
  onControl: (callback: typeof receive) => {
    receive = callback;
    return () => {};
  },
} as any;
const error = vi.fn();
const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: `common.whiteboard.${name}` }));
const draw = () =>
  act(() => {
    native.layout({ nativeEvent: { layout: { width: 400, height: 300 } } });
    native.pan.onPanResponderGrant({ nativeEvent: { locationX: 20, locationY: 30 } });
    native.pan.onPanResponderMove({ nativeEvent: { locationX: 200, locationY: 180 } });
    native.pan.onPanResponderRelease();
  });
beforeEach(() => {
  vi.useFakeTimers();
  request.mockReset().mockResolvedValue({ success: true });
  render(
    <Whiteboard
      id="board"
      room={room}
      chat={chat}
      t={t}
      onError={error}
      onDrawingChange={onDrawing}
    />,
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('sends selected colour/width and synchronizes undo, redo and clear without deleting other authors', async () => {
  click('color #ff4d4f');
  click('stroke_size');
  draw();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(request.mock.lastCall?.[0].handWriting.strokes[0]).toMatchObject({
    color: '#ff4d4f',
    width: expect.closeTo(0.009),
  });
  expect(onDrawing).toHaveBeenCalledWith(true);
  expect(onDrawing).toHaveBeenLastCalledWith(false);
  act(() =>
    receive('whiteboard', {
      receiverId: 'board',
      space: 'demo',
      senderId: 'other',
      handWriting: { strokes: [{ id: 'remote', color: '#222222', points: [{ x: 0.2, y: 0.2 }] }] },
    }),
  );
  click('undo');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(request.mock.lastCall?.[0].handWriting.strokes).toEqual([]);
  expect(document.querySelectorAll('polyline')).toHaveLength(1);
  click('redo');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(request.mock.lastCall?.[0].handWriting.strokes).toHaveLength(1);
  click('clear_self');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(request.mock.lastCall?.[0].handWriting.strokes).toEqual([]);
  expect(document.querySelectorAll('polyline')).toHaveLength(1);
});
it('serializes a clear behind an in-flight stroke instead of allowing old ink to arrive last', async () => {
  let finish!: () => void;
  request.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  draw();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  click('clear_self');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.lastCall?.[0].handWriting.strokes).toEqual([]);
});
it('erases strokes between sparse points and allows undo', async () => {
  draw();
  click('eraser');
  act(() => {
    native.pan.onPanResponderGrant({ nativeEvent: { locationX: 110, locationY: 105 } });
    native.pan.onPanResponderRelease();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(request.mock.lastCall?.[0].handWriting.strokes).toEqual([]);
  click('undo');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(request.mock.lastCall?.[0].handWriting.strokes).toHaveLength(1);
  const strokes = request.mock.lastCall?.[0].handWriting.strokes;
  expect(eraseWhiteboardStrokes(strokes, 399, 299, 400, 300)).toEqual(strokes);
});
