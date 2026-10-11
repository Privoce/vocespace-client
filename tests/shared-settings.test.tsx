import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MeetingSettingsForm, MeetingSettingsNavigation } from '@vocespace/ui';
import type { MeetingButtonProps, MeetingInputProps } from '@vocespace/ui';
import type { GeneralSettingsProps } from '../apps/web/components/Settings/panels/general';
import { useGeneralSettings } from '../apps/web/components/Settings/hooks/useGeneralSettings';

const mocks = vi.hoisted(() => ({
  persistentSpace: vi.fn(),
  allowGuest: vi.fn(),
  defineUserStatus: vi.fn(),
  emit: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  t: (key: string) => key,
}));
vi.mock('../apps/web/lib/api/index', () => ({ api: mocks }));
vi.mock('../apps/web/lib/realtime/socket', () => ({ socket: { emit: mocks.emit } }));
vi.mock('../apps/web/lib/i18n/i18n', () => ({ useI18n: () => ({ t: mocks.t }) }));
vi.mock('../apps/web/lib/std/index', () => ({
  UserStatus: { Online: 'online' },
  TransIfSystemStatus: (_t: unknown, value: string) => value,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function Button({ label, active, children, onPress, disabled }: MeetingButtonProps) {
  return (
    <button aria-label={label} aria-pressed={active} disabled={disabled} onClick={onPress}>
      {children}
    </button>
  );
}
function Input({ value, onChangeText, placeholder, disabled }: MeetingInputProps) {
  return (
    <input
      aria-label={placeholder}
      value={value}
      disabled={disabled}
      onChange={(event) => onChangeText(event.target.value)}
    />
  );
}
function props(owner = 'me'): GeneralSettingsProps {
  return {
    space: 'room-a',
    localParticipant: { identity: 'me' } as GeneralSettingsProps['localParticipant'],
    messageApi: mocks as unknown as GeneralSettingsProps['messageApi'],
    appendStatus: false,
    openPromptSound: true,
    setOpenPromptSound: vi.fn(),
    spaceInfo: {
      ownerId: owner,
      persistence: false,
      allowGuest: 'allow',
      participants: { me: { status: 'online' } },
    } as unknown as GeneralSettingsProps['spaceInfo'],
  };
}
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('shared room settings', () => {
  it('renders only supplied capabilities and does not toggle an active or disabled choice', () => {
    const change = vi.fn();
    const view = render(
      <MeetingSettingsForm
        Button={Button}
        Input={Input}
        fields={[
          {
            id: 'mic',
            kind: 'toggle',
            label: 'Microphone',
            value: false,
            onChange: change,
            onLabel: 'On',
            offLabel: 'Off',
            disabled: true,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Microphone: On' }));
    expect(change).not.toHaveBeenCalled();
    view.rerender(
      <MeetingSettingsForm
        Button={Button}
        Input={Input}
        fields={[
          {
            id: 'mic',
            kind: 'toggle',
            label: 'Microphone',
            value: false,
            onChange: change,
            onLabel: 'On',
            offLabel: 'Off',
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Microphone: Off' }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Microphone: On' }));
    expect(change).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Room permissions')).toBeNull();
  });
  it('navigates allowed panels and returns without owning or resetting form state', () => {
    const select = vi.fn();
    const back = vi.fn();
    const base = {
      name: 'Guest',
      spaceName: 'Room',
      panels: [
        { id: 'general', label: 'General', group: 'room' },
        { id: 'audio', label: 'Audio', group: 'devices' },
      ],
      onSelect: select,
      onBack: back,
      backLabel: 'Back',
      Button,
      Icon: () => null,
    };
    const view = render(<MeetingSettingsNavigation {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
    expect(select).toHaveBeenCalledWith('audio');
    view.rerender(<MeetingSettingsNavigation {...base} activePanel="audio" />);
    expect(screen.queryByRole('button', { name: 'General' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).toHaveBeenCalledOnce();
  });
  it('does not send owner mutations for a visitor or after ownership is revoked', async () => {
    const view = renderHook((value) => useGeneralSettings(value), { initialProps: props() });
    view.rerender(props('someone-else'));
    await act(async () => {
      await view.result.current.savePersistence(true);
      await view.result.current.saveAllowGuest('disable');
    });
    expect(mocks.persistentSpace).not.toHaveBeenCalled();
    expect(mocks.allowGuest).not.toHaveBeenCalled();
  });
  it('deduplicates pending writes and retains the confirmed value on failure', async () => {
    const request = deferred();
    mocks.persistentSpace.mockReturnValueOnce(request.promise);
    const { result } = renderHook(() => useGeneralSettings(props()));
    act(() => {
      void result.current.savePersistence(true);
      void result.current.savePersistence(true);
    });
    expect(mocks.persistentSpace).toHaveBeenCalledTimes(1);
    expect(result.current.busy.persistence).toBe(true);
    expect(result.current.persistence).toBe(false);
    await act(async () => {
      request.resolve(new Response('', { status: 403 }));
    });
    expect(result.current.persistence).toBe(false);
    expect(result.current.busy.persistence).toBe(false);
    expect(mocks.error).toHaveBeenCalledOnce();
  });
  it('updates the selected guest policy only after a successful write', async () => {
    const request = deferred();
    mocks.allowGuest.mockReturnValueOnce(request.promise);
    const { result } = renderHook(() => useGeneralSettings(props()));
    act(() => {
      void result.current.saveAllowGuest('link');
    });
    expect(result.current.allowGuest).toBe('allow');
    await act(async () => {
      request.resolve(new Response('{}', { status: 200 }));
    });
    expect(result.current.allowGuest).toBe('link');
    expect(mocks.success).toHaveBeenCalledOnce();
  });
  it('preserves an edited status across incoming updates and failed saves', async () => {
    mocks.defineUserStatus.mockRejectedValueOnce(new Error('offline'));
    const initial = props();
    const { result, rerender } = renderHook((value) => useGeneralSettings(value), {
      initialProps: initial,
    });
    act(() => result.current.setStatus('My draft'));
    rerender({
      ...initial,
      spaceInfo: {
        ...initial.spaceInfo,
        participants: {
          me: { status: 'busy' },
        } as unknown as GeneralSettingsProps['spaceInfo']['participants'],
      },
    });
    expect(result.current.status).toBe('My draft');
    await act(async () => {
      await result.current.saveStatus();
    });
    expect(result.current.status).toBe('My draft');
    expect(mocks.emit).not.toHaveBeenCalled();
  });
  it('ignores a late successful status response after the settings owner unmounts', async () => {
    const request = deferred();
    mocks.defineUserStatus.mockReturnValueOnce(request.promise);
    const view = renderHook(() => useGeneralSettings(props()));
    act(() => {
      void view.result.current.saveStatus();
    });
    view.unmount();
    await act(async () => {
      request.resolve(Response.json({ success: true }));
    });
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
  });
  it('requires a confirmed status write before notifying the current room', async () => {
    mocks.defineUserStatus.mockResolvedValueOnce(Response.json({ success: false }));
    const { result } = renderHook(() => useGeneralSettings(props()));
    act(() => result.current.setStatus('Working'));
    await act(async () => {
      await result.current.saveStatus();
    });
    expect(mocks.emit).not.toHaveBeenCalled();
    expect(result.current.status).toBe('Working');
    mocks.defineUserStatus.mockResolvedValueOnce(
      Response.json({ success: true, spaceName: 'room-a' }),
    );
    await act(async () => {
      await result.current.saveStatus();
    });
    expect(mocks.emit).toHaveBeenCalledExactlyOnceWith('update_user_status', { space: 'room-a' });
  });
});
