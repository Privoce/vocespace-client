import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MeetingParticipantTools, meetingIconSources, type MeetingIconName } from '@vocespace/ui';
import { MeetingButton, MeetingIcon } from '../apps/web/components/MeetingUI/primitives';
afterEach(cleanup);
it('renders every shared meeting icon using the real Web SVG adapter', () => {
  for (const name of Object.keys(meetingIconSources) as MeetingIconName[]) {
    const view = render(<MeetingIcon name={name} />);
    expect(view.container.querySelector('svg'), name).not.toBeNull();
    expect(
      view.container.querySelector('path,rect,line,circle,polygon,polyline,ellipse'),
      name,
    ).not.toBeNull();
    view.unmount();
  }
});
it('shares tool order, labels and capability gating without firing unsupported actions', () => {
  const avatar = vi.fn();
  const focus = vi.fn();
  const props = {
    Button: MeetingButton,
    Icon: MeetingIcon,
    focused: false,
    onFocus: focus,
    onFullscreen: vi.fn(),
    labels: {
      focus: 'Focus',
      unfocus: 'Unfocus',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      avatar: 'Avatar',
      apps: 'Apps',
    },
  };
  const view = render(<MeetingParticipantTools {...props} />);
  expect(screen.getAllByRole('button').map((x) => x.getAttribute('aria-label'))).toEqual([
    'Focus',
    'Fullscreen',
  ]);
  expect(screen.queryByText('Focus')).toBeNull();
  view.rerender(<MeetingParticipantTools {...props} onAvatar={avatar} />);
  fireEvent.click(screen.getByRole('button', { name: 'Avatar' }));
  expect(avatar).toHaveBeenCalledOnce();
  expect(focus).not.toHaveBeenCalled();
  view.rerender(<MeetingParticipantTools {...props} focused fullscreen />);
  expect(screen.getAllByRole('button').map((x) => x.getAttribute('aria-label'))).toEqual([
    'Unfocus',
    'Exit fullscreen',
  ]);
});
