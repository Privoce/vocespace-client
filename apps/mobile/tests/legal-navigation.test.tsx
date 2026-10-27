import { useEffect, useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@ant-design/react-native/lib/toast', () => ({ default: { fail: vi.fn() } }));
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../src/account/ProfilePage', () => ({
  ProfilePage: ({ children, onBack }: { children: ReactNode; onBack: () => void }) => (
    <div>
      <button onClick={onBack}>Back</button>
      {children}
    </div>
  ),
}));
import { LegalPages } from '../src/legal/LegalPages';
import { useLegalNavigation } from '../src/legal/hooks/useLegalNavigation';
afterEach(cleanup);
it('opens full legal pages and preserves the originating form and connection lifetime on return', () => {
  const unmount = vi.fn();
  function Form() {
    const [email, setEmail] = useState('');
    const open = useLegalNavigation();
    useEffect(() => unmount, []);
    return (
      <>
        <input
          aria-label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button onClick={() => open('terms')}>Read terms</button>
      </>
    );
  }
  render(
    <LegalPages>
      <Form />
    </LegalPages>,
  );
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'draft@example.test' } });
  fireEvent.click(screen.getByText('Read terms'));
  expect(screen.getByText('VoceSpace Terms of Service')).toBeTruthy();
  expect(unmount).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole('link', { name: 'Privacy Policy' })[0]);
  expect(screen.getByText('VoceSpace Privacy Policy')).toBeTruthy();
  fireEvent.click(screen.getByText('Back'));
  expect(screen.getByText('VoceSpace Terms of Service')).toBeTruthy();
  fireEvent.click(screen.getByText('Back'));
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('draft@example.test');
  expect(unmount).not.toHaveBeenCalled();
});
