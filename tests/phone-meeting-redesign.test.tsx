import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  MeetingDock,
  MeetingMenu,
  MeetingSheet,
  AuthSettingsContent,
  type MeetingButtonProps,
  type MeetingInputProps,
} from '@vocespace/ui';
import { settingsElements } from '../apps/web/components/Settings/phone-content';
const Button = ({ children, label, disabled, onPress }: MeetingButtonProps) => (
  <button aria-label={label} disabled={disabled} onClick={onPress}>
    {children}
  </button>
);
const Icon = () => null;
afterEach(cleanup);
describe('Phone meeting redesign behavior', () => {
  it('keeps the inline draft alive while switching between chat and members', () => {
    function Harness() {
      const [draft, setDraft] = useState('');
      return (
        <MeetingDock
          Button={Button}
          Icon={Icon}
          chatLabel="Chat"
          membersLabel="Members"
          expandLabel="Expand"
          count={2}
          onExpand={() => {}}
          chat={
            <input aria-label="Draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
          }
          members={<span>Members list</span>}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Unsaved message' } });
    fireEvent.click(screen.getByRole('tab', { name: /Members/ }));
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Chat/ }));
    expect(screen.getByRole('textbox')).toBe(input);
    expect((input as HTMLInputElement).value).toBe('Unsaved message');
  });
  it('opens the selected expanded view and never publishes from disabled menu actions', () => {
    const expand = vi.fn(),
      raise = vi.fn(),
      share = vi.fn();
    const view = render(
      <MeetingDock
        Button={Button}
        Icon={Icon}
        chatLabel="Chat"
        membersLabel="Members"
        expandLabel="Expand"
        count={2}
        onExpand={expand}
        chat={null}
        members={null}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Members/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(expand).toHaveBeenCalledWith('members');
    view.rerender(
      <MeetingMenu
        Button={Button}
        Icon={Icon}
        actions={[
          { id: 'hand', icon: 'hand', label: 'Raise', disabled: true, onPress: raise },
          { id: 'share', icon: 'link', label: 'Share', onPress: share },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Raise' }));
    expect(raise).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledOnce();
  });
  it('keeps the settings draft mounted when permission details collapse', () => {
    const view = render(
      AuthSettingsContent({
        elements: settingsElements,
        styles: {},
        t: (key) => key,
        slots: {
          microphone: <button disabled>Microphone</button>,
          camera: <button disabled>Camera</button>,
          table: <input aria-label="Permission draft" defaultValue="" />,
          save: <button>Save</button>,
        },
      }),
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    const details = screen.getByRole('button', { name: 'phone_meeting.manage_permissions' });
    fireEvent.click(details);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'pending permission edit' } });
    fireEvent.click(details);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(details);
    expect(screen.getByRole('textbox')).toBe(input);
    expect((input as HTMLInputElement).value).toBe('pending permission edit');
  });
});
