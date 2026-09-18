import React, { useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { useLayoutDevice } from '@/lib/hooks/use-layout-device';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('uses a stable SSR snapshot and preserves controller state when resizing', () => {
  let phone = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return phone; },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) }));
  function Page() {
    const device = useLayoutDevice();
    const [name, setName] = useState('');
    return <div><span>{device}</span><input aria-label="name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => setName('Alice')}>edit</button></div>;
  }
  expect(renderToString(<Page />)).toContain('pc');
  const view = render(<Page />);
  expect(screen.getByText('phone')).toBeTruthy();
  act(() => screen.getByText('edit').click());
  act(() => { phone = false; listeners.forEach((notify) => notify()); });
  expect(screen.getByText('pc')).toBeTruthy();
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('Alice');
  view.unmount();
  expect(listeners.size).toBe(0);
});
