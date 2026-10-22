import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../src/ui/settings', () => ({
  PhoneSettingsButton: ({ children, onPress, disabled }: any) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  PhoneSettingsInput: () => null,
}));
vi.mock('../src/ui/meeting', () => ({
  MeetingSettingsRange: () => null,
  MeetingIcon: () => <svg />,
  MeetingButton: ({ children, onPress, label }: any) => (
    <button onClick={onPress} aria-label={label}>
      {children}
    </button>
  ),
}));
vi.mock('../src/ui/controls', () => ({ Switch: () => null, IconOutline: () => null }));
import { SettingsDialog } from '../src/ui/settings-widgets';
afterEach(cleanup);
it('closes feedback from its header without adding a footer over the submit action', () => {
  const close = vi.fn();
  render(
    <SettingsDialog open closeInHeader title="Feedback" onClose={close}>
      <button>Submit feedback</button>
    </SettingsDialog>,
  );
  expect(screen.queryByText('common.cancel')).toBeNull();
  expect(screen.getByRole('button', { name: 'Submit feedback' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
  expect(close).toHaveBeenCalledOnce();
});
it('preserves cancel and confirmation for existing settings dialogs', () => {
  const close = vi.fn(),
    confirm = vi.fn();
  render(
    <SettingsDialog open title="Settings" onClose={close} onConfirm={confirm} confirmLabel="Save">
      <p>Settings fields</p>
    </SettingsDialog>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(confirm).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
  expect(close).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'common.close' })).toBeNull();
});
