import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { meetingPage, meetingTileSize, meetingPageSwipe } from '../packages/meeting-core/src';
import {
  PhoneMeeting,
  MeetingChat,
  MeetingControls,
  MeetingTileActions,
  type PhoneMeetingProps,
} from '@vocespace/ui';
import { MeetingInput, MeetingIcon } from '../apps/web/components/MeetingUI/primitives';

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
  grid: 'Grid',
  focusLayout: 'Focus layout',
  page: 'Page',
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
    renderTileActions: (item, focused, toggle) => (
      <MeetingTileActions
        Button={props().Button}
        Icon={() => null}
        actions={[
          {
            id: 'focus',
            icon: 'focus',
            label: `${focused ? 'Unpin' : 'Focus'} ${item.name}`,
            onPress: toggle,
          },
        ]}
      />
    ),
    renderVideo: () => null,
    controls: null,
  };
}
describe('shared meeting presentation', () => {
  it('renders the original host SVG resource in the requested color', () => {
    const { container } = render(<MeetingIcon name="host" color="#FFAA33" size={14} />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1024 1024');
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('#FFAA33');
  });
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
    expect(screen.queryByText('Camera')).toBeNull();
    expect(screen.queryByText('Chat')).toBeNull();
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
  it('starts in a four-tile grid even with a dock and a screen share, and keeps the focused media mounted', () => {
    const view = render(
      <PhoneMeeting
        {...props()}
        Icon={() => null}
        dock={<span>Dock</span>}
        tiles={tiles.map((tile, index) => ({ ...tile, screen: index === 0, video: true }))}
        renderVideo={(id) => <input aria-label={`Media ${id}`} defaultValue="Playing" />}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Grid' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
    const media = screen.getByRole('textbox', { name: 'Media 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Focus Person 1' }));
    expect(screen.getByRole('tab', { name: 'Focus layout' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: 'Media 1' })).toBe(media);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('textbox', { name: 'Media 1' })).toBe(media);
    expect(screen.getByText('2 / 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Grid' }));
    expect(screen.getByRole('textbox', { name: 'Media 1' })).toBe(media);
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
    view.unmount();
  });
  it('focuses the current page from the header, returns to its grid page and clamps after departures', () => {
    const view = render(<PhoneMeeting {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(screen.queryByText('Person 0')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Focus layout' }));
    expect(screen.getByRole('button', { name: 'Unpin Person 4' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Grid' }));
    expect(screen.getByText('2 / 2')).toBeTruthy();
    view.rerender(<PhoneMeeting {...props()} tiles={tiles.slice(0, 2)} />);
    expect(screen.getByText('1 / 1')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).getAttribute(
        'aria-disabled',
      ),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Focus Person 0' }));
    view.rerender(<PhoneMeeting {...props()} tiles={tiles.slice(1, 2)} />);
    expect(screen.getByRole('tab', { name: 'Grid' }).getAttribute('aria-selected')).toBe('true');
  });
  it('handles a swipe on the stage without treating a short drag as a page change', () => {
    render(<PhoneMeeting {...props()} />);
    const stage = screen.getByTestId('meeting-stage');
    fireEvent.mouseDown(stage, { clientX: 300, clientY: 100, buttons: 1 });
    fireEvent.mouseMove(stage, { clientX: 270, clientY: 100, buttons: 1 });
    fireEvent.mouseMove(stage, { clientX: 150, clientY: 100, buttons: 1 });
    fireEvent.mouseUp(stage, { clientX: 150, clientY: 100 });
    expect(screen.getByText('2 / 2')).toBeTruthy();
    fireEvent.mouseDown(stage, { clientX: 100, clientY: 100, buttons: 1 });
    fireEvent.mouseMove(stage, { clientX: 130, clientY: 100, buttons: 1 });
    fireEvent.mouseUp(stage, { clientX: 110, clientY: 100 });
    expect(screen.getByText('2 / 2')).toBeTruthy();
    fireEvent.mouseDown(stage, { clientX: 100, clientY: 100, buttons: 1 });
    fireEvent.mouseMove(stage, { clientX: 130, clientY: 100, buttons: 1 });
    fireEvent.mouseMove(stage, { clientX: 250, clientY: 100, buttons: 1 });
    fireEvent.mouseUp(stage, { clientX: 250, clientY: 100 });
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });
  it('pages through touch input and cancels a terminated gesture', () => {
    render(<PhoneMeeting {...props()} />);
    const stage = screen.getByTestId('meeting-stage');
    const touch = (x: number) => ({
      identifier: 1,
      target: stage,
      clientX: x,
      clientY: 100,
      pageX: x,
      pageY: 100,
    });
    fireEvent.touchStart(stage, { touches: [touch(300)], changedTouches: [touch(300)] });
    fireEvent.touchMove(stage, { touches: [touch(270)], changedTouches: [touch(270)] });
    fireEvent.touchEnd(stage, { touches: [], changedTouches: [touch(150)] });
    expect(screen.getByText('2 / 2')).toBeTruthy();
    fireEvent.touchStart(stage, { touches: [touch(100)], changedTouches: [touch(100)] });
    fireEvent.touchMove(stage, { touches: [touch(250)], changedTouches: [touch(250)] });
    fireEvent.touchCancel(stage, { touches: [], changedTouches: [touch(250)] });
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });
  it('only pages on committed horizontal swipes; short, diagonal, vertical and returned drags cancel', () => {
    expect(meetingPageSwipe(-100, 20)).toBe(1);
    expect(meetingPageSwipe(100, -20)).toBe(-1);
    for (const [dx, dy] of [
      [-63, 0],
      [0, 120],
      [90, 80],
      [10, 0],
      [0, 0],
    ]) {
      expect(meetingPageSwipe(dx, dy)).toBe(0);
    }
    expect(meetingPage(tiles, 2, '0', 2)).toMatchObject({ page: 2, pages: 3, tiles: [tiles[5]] });
    expect(meetingPage(tiles.slice(0, 2), 2, '0', 2)).toMatchObject({ page: 0, pages: 1 });
  });
  it('pages and focuses using the same component on RN Web', () => {
    render(<PhoneMeeting {...props()} />);
    expect(screen.getAllByRole('button', { name: /^Focus Person / })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Focus Person 5' }));
    expect(screen.getByRole('button', { name: 'Unpin Person 5' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unpin Person 5' }));
    expect(screen.queryByRole('button', { name: /^Unpin/ })).toBeNull();
  });
  it('delivers avatar clicks without focusing and focuses only through the tool button', () => {
    const interact = vi.fn();
    render(
      <PhoneMeeting
        {...props()}
        renderAvatar={(item) => <button onClick={interact}>AVO {item.name}</button>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'AVO Person 0' }));
    expect(interact).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /^Unpin/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Focus Person 0' }));
    expect(screen.getByRole('button', { name: 'Unpin Person 0' })).toBeTruthy();
  });
  it('provides an explicit focus button on the compact participant rail', () => {
    render(<PhoneMeeting {...props()} Icon={() => null} dock={<span>Inline chat</span>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus Person 1' }));
    expect(screen.getByRole('button', { name: 'Unpin Person 1' })).toBeTruthy();
    expect(screen.queryByText('Focus Person 1')).toBeNull();
  });
  it('keeps raised hands visible until data changes and allows only the local member to lower theirs', () => {
    const lower = vi.fn();
    const people = [
      { id: 'self', name: 'Self', local: true, raiseHand: true, owner: true },
      { id: 'other', name: 'Other', raiseHand: true },
    ];
    const options = {
      ...props(),
      tiles: people,
      Icon: ({ name, color }: { name: string; color?: string }) => (
        <span data-testid={name} data-color={color} />
      ),
      onLowerHand: lower,
      handLabel: 'Hand raised',
      lowerHandLabel: 'Lower hand',
    };
    const view = render(<PhoneMeeting {...options} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lower hand' }));
    expect(lower).toHaveBeenCalledWith(people[0]);
    expect(screen.getAllByTestId('hand')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Hand raised' })).toBeNull();
    expect(screen.getByTestId('host').getAttribute('data-color')).toBe('#FFAA33');
    view.rerender(
      <PhoneMeeting {...options} tiles={people.map((item) => ({ ...item, raiseHand: false }))} />,
    );
    expect(screen.queryByTestId('hand')).toBeNull();
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

it('keeps a lone focus rail tile half-width and overlays metadata on the video', () => {
  render(<PhoneMeeting {...props()} tiles={tiles.slice(0, 2)} />);
  fireEvent.click(screen.getByLabelText('Focus Person 0'));
  expect(document.getElementById('meeting-tile-1')?.style.width).toBe('48.5%');
  const hero = document.getElementById('meeting-tile-0')!;
  expect(hero.style.width).toBe('100%');
  // Only the action bar is reserved: names/status sit over the media, not in an extra row.
  expect((hero.firstElementChild as HTMLElement).style.bottom).toBe('38px');
});
