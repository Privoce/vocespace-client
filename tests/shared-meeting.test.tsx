import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { meetingPage, meetingTileSize } from '../packages/meeting-core/src';
import {
  PhoneMeeting,
  MeetingChat,
  MeetingControls,
  type PhoneMeetingProps,
} from '@vocespace/ui';
import { MeetingInput } from '../apps/web/components/MeetingUI/primitives';

beforeEach(() => {
  // JSDOM has no native ResizeObserver; Ant Design's textarea uses it for autosizing.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const tiles = Array.from({ length: 6 }, (_, index) => ({
  id: String(index),
  name: `Person ${index}`,
}));
const labels = {
  previous: 'Previous',
  next: 'Next',
  focus: 'Focus',
  unfocus: 'Unpin',
  cameraOff: 'Camera off',
  empty: 'Waiting',
  chat: 'Chat',
  close: 'Close',
};
function props(): PhoneMeetingProps {
  return {
    name: 'Test room',
    status: 'Connected',
    tiles,
    labels,
    Button: ({ children, onPress, disabled, label }) => (
      <button aria-label={label} disabled={disabled} onClick={onPress}>
        {children}
      </button>
    ),
    renderVideo: () => null,
    controls: null,
  };
}
describe('shared meeting presentation', () => {
  it('fills a tall phone stage, keeps a two-column grid and scrolls on short windows', () => {
    expect(meetingTileSize(390, 640, 2, false)).toMatchObject({ width: 184, height: 624 });
    expect(meetingTileSize(390, 640, 4, false)).toMatchObject({ width: 184, height: 309 });
    expect(meetingTileSize(390, 180, 4, true)).toMatchObject({
      height: 150,
      focusHeight: 200,
      railHeight: 132,
    });
    expect(meetingTileSize(390, 640, 1, false).width).toBe(374);
  });
  it('renders capability-gated controls without firing actions on mount or disabled presses', () => {
    const publish = vi.fn();
    const chat = vi.fn();
    render(
      <MeetingControls
        Button={props().Button}
        Icon={() => null}
        actions={[
          { id: 'camera', icon: 'camera', label: 'Camera', disabled: true, onPress: publish },
          { id: 'chat', icon: 'chat', label: 'Chat', onPress: chat },
        ]}
      />,
    );
    expect(publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Camera' }));
    expect(publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(chat).toHaveBeenCalledOnce();
  });
  it('keeps offline drafts editable and blocks empty, offline, pending and IME sends', () => {
    const send = vi.fn();
    const onDraft = vi.fn();
    const base = {
      Button: props().Button,
      Icon: () => null,
      Input: MeetingInput,
      messages: [],
      draft: 'Hello',
      onDraft,
      onSend: send,
      maxLength: 4000,
      placeholder: 'Draft',
      sendLabel: 'Send',
      emptyLabel: 'No messages',
    };
    const view = render(<MeetingChat {...base} disabled />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Offline draft' } });
    expect(onDraft).toHaveBeenCalledWith('Offline draft');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(send).not.toHaveBeenCalled();
    view.rerender(<MeetingChat {...base} sending />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    view.rerender(<MeetingChat {...base} draft="   " />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(send).not.toHaveBeenCalled();
    view.rerender(<MeetingChat {...base} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true });
    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(send).toHaveBeenCalledOnce();
  });
  it('clamps pages when participants leave and excludes a focused tile from the grid', () => {
    expect(meetingPage(tiles, 9, undefined)).toMatchObject({
      page: 1,
      pages: 2,
      tiles: tiles.slice(4),
    });
    expect(meetingPage(tiles.slice(0, 1), 1, undefined)).toMatchObject({ page: 0, pages: 1 });
    const focused = meetingPage(tiles, 0, '2');
    expect(focused.focus?.id).toBe('2');
    expect(focused.tiles.map((tile) => tile.id)).not.toContain('2');
  });
  it('follows a screen share, permits dismissing focus and removes a departed pinned participant', () => {
    const withScreen = [...tiles, { id: 'screen', name: 'Screen', screen: true }];
    expect(meetingPage(withScreen, 0, undefined).focus?.id).toBe('screen');
    expect(meetingPage(withScreen, 0, null).focus).toBeUndefined();
    expect(meetingPage(tiles, 0, 'departed').focus).toBeUndefined();
    expect(meetingPage([], 8, 'departed')).toMatchObject({ page: 0, pages: 1, tiles: [] });
  });
  it('pages and focuses using the same component on RN Web', () => {
    render(<PhoneMeeting {...props()} />);
    expect(screen.getAllByRole('button', { name: /^Focus / })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Focus Person 5' }));
    expect(screen.getByRole('button', { name: 'Unpin Person 5' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unpin Person 5' }));
    expect(screen.queryByRole('button', { name: /^Unpin/ })).toBeNull();
  });
  it('keeps chat content and the draft mounted across closing and reopening', () => {
    const close = vi.fn();
    const content = <input aria-label="Draft" defaultValue="" />;
    const view = render(
      <PhoneMeeting {...props()} chat={{ open: true, onClose: close, content }} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledOnce();
    view.rerender(<PhoneMeeting {...props()} chat={{ open: false, onClose: close, content }} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    view.rerender(<PhoneMeeting {...props()} chat={{ open: true, onClose: close, content }} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Keep this draft');
  });
  it('uses the injected video renderer only for visible, playable tracks', () => {
    const video = vi.fn((_id: string) => <span>Video surface</span>);
    render(
      <PhoneMeeting
        {...props()}
        tiles={tiles.map((tile) => ({ ...tile, video: true }))}
        renderVideo={video}
      />,
    );
    expect(video.mock.calls.map(([id]) => id)).toEqual(['0', '1', '2', '3']);
  });
  it('preserves embedded widget state across pagination and external focus', () => {
    const extraTiles = [
      { id: 'widget', content: <input aria-label="Widget state" defaultValue="" /> },
    ];
    const view = render(<PhoneMeeting {...props()} extraTiles={extraTiles} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Widget state' }), {
      target: { value: 'Playing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    view.rerender(<PhoneMeeting {...props()} extraTiles={extraTiles} focusedExtraTile="widget" />);
    expect((screen.getByRole('textbox', { name: 'Widget state' }) as HTMLInputElement).value).toBe(
      'Playing',
    );
    view.rerender(<PhoneMeeting {...props()} extraTiles={extraTiles} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect((screen.getByRole('textbox', { name: 'Widget state' }) as HTMLInputElement).value).toBe(
      'Playing',
    );
  });
});
