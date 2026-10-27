import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { phoneButtonColors } from '@vocespace/ui';
vi.mock('../src/ui/controls', () => ({
  PrimaryButton: ({ children, disabled, onPress, style, styles }: any) => (
    <button
      disabled={disabled}
      onClick={onPress}
      style={style}
      data-text-color={styles.primaryRawText.color}
    >
      {children}
    </button>
  ),
  Input: () => null,
}));
import { PhoneSettingsButton } from '../src/ui/settings';
afterEach(cleanup);
it('renders save as a primary action and preserves disabled behavior when colors change', () => {
  const save = vi.fn();
  const view = render(
    <PhoneSettingsButton tone="primary" onPress={save}>
      Save
    </PhoneSettingsButton>,
  );
  const button = screen.getByRole('button', { name: 'Save' });
  expect(button.style.backgroundColor).toBe('rgb(34, 204, 238)');
  expect(button.getAttribute('data-text-color')).toBe(phoneButtonColors.primaryText);
  fireEvent.click(button);
  expect(save).toHaveBeenCalledOnce();
  view.rerender(
    <PhoneSettingsButton tone="primary" disabled onPress={save}>
      Save
    </PhoneSettingsButton>,
  );
  fireEvent.click(button);
  expect(save).toHaveBeenCalledOnce();
  expect(button.getAttribute('data-text-color')).toBe(phoneButtonColors.disabledText);
});
it('does not turn radio choices into filled primary buttons when selected', () => {
  render(
    <PhoneSettingsButton appearance="option" active>
      Enabled
    </PhoneSettingsButton>,
  );
  const button = screen.getByRole('button');
  expect(button.style.backgroundColor).toBe('transparent');
  expect(button.getAttribute('data-text-color')).toBe(phoneButtonColors.selectedText);
});
