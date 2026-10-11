import { useEffect, useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PhoneSettingsNavigation } from '@vocespace/ui';
import { SettingsPhone } from '../apps/web/components/Settings/phone';
import { OriginalSettingsPhone } from './fixtures/settings-phone-original';
import { Settings, type SettingsProps } from '../apps/web/components/Settings';
import type { SettingsModel } from '../apps/web/components/Settings/panels';

const state = vi.hoisted(() => ({ model: {} as SettingsModel, mounted: vi.fn() }));
const labels = [
  'general',
  'profile',
  'auth',
  'ai',
  'audio',
  'video',
  'app',
  'recording',
  'license',
  'about_us',
];
vi.mock('../apps/web/components/Settings/hooks/useSettings', () => ({
  useSettings: () => state.model,
}));
vi.mock('../apps/web/components/Settings/panels', () => ({
  getSettingsPanels: () =>
    labels.map((key) => ({
      key,
      label: <span>{key}</span>,
      children: key === 'general' ? <Draft /> : <span>{key} content</span>,
    })),
}));
function Draft() {
  const [text, setText] = useState('');
  useEffect(() => {
    state.mounted();
  }, []);
  return (
    <input aria-label="Preserved draft" value={text} onChange={(e) => setText(e.target.value)} />
  );
}
function model(open = false): SettingsModel {
  return {
    username: 'Guest',
    localParticipant: { identity: 'visitor' },
    space: { name: 'test-space' },
    key: 'general',
    phonePanelOpen: open,
    device: 'phone',
    t: (key: string) => key,
    selectPanel: vi.fn(),
    setPhonePanelOpen: vi.fn(),
  } as unknown as SettingsModel;
}
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Phone-only extraction preserves approved Web settings', () => {
  it.each([false, true])(
    'keeps the exact original Web DOM, classes and icons (panel open: %s)',
    (open) => {
      const props = { model: model(open) };
      expect(renderToStaticMarkup(<SettingsPhone {...props} />)).toBe(
        renderToStaticMarkup(<OriginalSettingsPhone {...props} />),
      );
    },
  );
  it('preserves the original grouped order and forwards navigation without replacing panel content', () => {
    const m = model();
    render(<SettingsPhone model={m} />);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(labels);
    fireEvent.click(screen.getByRole('button', { name: /^audio/ }));
    expect(m.selectPanel).toHaveBeenCalledExactlyOnceWith('audio');
  });
  it('keeps the original PC Tabs and the same edited panel instance across phone/PC changes', () => {
    state.model = { ...model(true), device: 'pc' };
    const view = render(<Settings {...({} as SettingsProps)} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    const input = screen.getByRole('textbox', { name: 'Preserved draft' });
    fireEvent.change(input, { target: { value: 'do not reset' } });
    state.model = { ...state.model, device: 'phone' };
    view.rerender(<Settings {...({} as SettingsProps)} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('textbox')).toBe(input);
    state.model = { ...state.model, device: 'pc' };
    view.rerender(<Settings {...({} as SettingsProps)} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('do not reset');
    expect(state.mounted).toHaveBeenCalledOnce();
  });
  it('uses the extracted Phone groups and back navigation with Native primitives too', () => {
    const select = vi.fn();
    const back = vi.fn();
    const props = {
      name: 'Guest',
      spaceName: 'test-space',
      panels: [
        { id: 'general', label: 'General' },
        { id: 'audio', label: 'Audio' },
      ],
      onSelect: select,
      onBack: back,
      backLabel: 'Back',
    };
    const view = render(<PhoneSettingsNavigation {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Audio/ }));
    expect(select).toHaveBeenCalledExactlyOnceWith('audio');
    view.rerender(<PhoneSettingsNavigation {...props} activePanel="audio" />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).toHaveBeenCalledOnce();
  });
});
