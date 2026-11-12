import { useMemo, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@vocespace/client-sdk';

vi.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children: ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
  Modal: ({ children, visible }: { children: ReactNode; visible: boolean }) =>
    visible ? children : null,
  Image: () => null,
  TextInput: () => null,
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: () => null }));
vi.mock('react-native-webview', () => ({ WebView: () => null }));
vi.mock('@ant-design/icons-react-native', () => ({ IconOutline: () => null }));
vi.mock('../src/ui/meeting', () => ({ MeetingButton: () => null, MeetingIcon: () => null }));
vi.mock('../src/ui/document-picker', () => ({ pickDocument: vi.fn() }));
vi.mock('../src/conference/tools/Whiteboard', () => ({ Whiteboard: () => null }));
vi.mock('@vocespace/ui', () => ({
  MeetingToolsPanel: ({
    items,
  }: {
    items: { id: string; content: (close: () => void) => ReactNode }[];
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.id}>{item.content(() => {})}</div>
      ))}
    </div>
  ),
}));
import { useMeetingTools } from '../src/conference/tools/useMeetingTools';
const uploadFile = vi.fn();
const listFiles = vi.fn();
const chat = {
  onControl: () => () => {},
  files: { upload: uploadFile, list: listFiles },
  state: { connection: 'connected' },
} as unknown as Parameters<typeof useMeetingTools>[1];
const t = (key: string) => key;
function Harness({ request }: { request: ReturnType<typeof vi.fn> }) {
  const room = useMemo(
    () => ({ tools: request }) as unknown as Parameters<typeof useMeetingTools>[0],
    [request],
  );
  const tools = useMeetingTools(room, chat, t, () => {});
  return (
    <>
      {tools.panel}
      {tools.extraTiles.map((tile) => (
        <div key={tile.id}>{tile.content}</div>
      ))}
    </>
  );
}
function room(request: ReturnType<typeof vi.fn>) {
  return <Harness request={request} />;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('keeps list failures out of the tile and continues polling until recovery', async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new ApiError(403, 'NATIVE_ENDPOINT_REQUIRED', 'Request failed'))
    .mockResolvedValue({ players: [{ id: 'board', mode: 'whiteboard' }] });
  await act(async () => {
    render(room(request));
  });
  expect(screen.queryByText(/tools_unavailable/)).toBeNull();
  expect(screen.queryByText(/tools_error/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'whiteboard' })).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(screen.queryByText(/tools_unavailable/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'whiteboard' })).not.toBeNull();
});

it('does not add error content to the tool tile after a failed action', async () => {
  const request = vi.fn().mockImplementation(async (body: { action: string }) => {
    if (body.action !== 'ls') throw new Error('network');
    return { players: [] };
  });
  await act(async () => {
    render(room(request));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'common.whiteboard.title' }));
  });
  expect(screen.queryByText('shared_meeting.tools_error')).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(screen.queryByText('shared_meeting.tools_error')).toBeNull();
});

it('ignores an old room failure after moving to another room', async () => {
  let fail!: (error: Error) => void;
  const first = vi.fn().mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  const next = vi.fn().mockResolvedValue({ players: [] });
  const view = render(room(first));
  await act(async () => {
    view.rerender(room(next));
  });
  expect(first.mock.calls[0][1].aborted).toBe(true);
  await act(async () => {
    fail(new Error('network'));
  });
  expect(screen.queryByText(/tools_load_error/)).toBeNull();
});

it('offers file upload and browsing from the panel without an add-tools tile', async () => {
  await act(async () => {
    render(room(vi.fn().mockResolvedValue({ players: [] })));
  });
  fireEvent.click(screen.getByRole('button', { name: 'shared_meeting.upload' }));
  fireEvent.click(screen.getByRole('button', { name: 'shared_meeting.files' }));
  expect(uploadFile).toHaveBeenCalledOnce();
  expect(listFiles).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'common.chat' })).toBeNull();
});
