import { useMemo, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@vocespace/client-sdk';

vi.mock('@ant-design/react-native/lib/toast', () => ({ default: { info: vi.fn() } }));
vi.mock('react-native', () => ({
  BackHandler: { addEventListener: () => ({ remove: () => {} }) },
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
vi.mock('react-native-webview', () => ({ WebView: () => <div data-testid="web-preview" /> }));
vi.mock('@ant-design/icons-react-native', () => ({ IconOutline: () => null }));
vi.mock('../src/ui/meeting', () => ({ MeetingButton: ({ children, label, onPress }: { children: ReactNode; label: string; onPress: () => void }) => <button aria-label={label} onClick={onPress}>{children}</button>, MeetingIcon: () => null }));
vi.mock('../src/ui/document-picker', () => ({ pickDocument: vi.fn() }));
vi.mock('../src/conference/tools/Whiteboard', () => ({ Whiteboard: () => <div data-testid="whiteboard-preview" /> }));
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
      <output data-testid="fullscreen">{tools.fullscreenTileId}</output>
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
  expect(screen.queryByTestId('whiteboard-preview')).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(screen.queryByText(/tools_unavailable/)).toBeNull();
  expect(screen.queryByTestId('whiteboard-preview')).not.toBeNull();
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

it('renders embedded tools immediately, keeps them mounted in fullscreen and removes owned tiles', async () => {
  const player = { id: 'iframe', mode: 'iframe', url: 'https://example.org', canRemove: true };
  const request = vi.fn().mockImplementation(async ({ action }: { action: string }) => ({ players: action === 'rm' ? [] : [player] }));
  await act(async () => { render(room(request)); });
  const preview = screen.getByTestId('web-preview');
  fireEvent.click(screen.getByRole('button', { name: 'common.full_screen' }));
  expect(screen.getByTestId('fullscreen').textContent).toBe('tool:iframe');
  expect(screen.getByTestId('web-preview')).toBe(preview);
  fireEvent.click(screen.getByRole('button', { name: 'phone_meeting.exit_fullscreen' }));
  expect(screen.getByTestId('web-preview')).toBe(preview);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'common.close' })); });
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ action: 'rm', playerId: 'iframe' }), expect.any(AbortSignal));
  expect(screen.queryByTestId('web-preview')).toBeNull();
});
