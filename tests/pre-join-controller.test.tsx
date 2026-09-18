import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  save: vi.fn(), validate: vi.fn(), push: vi.fn(), error: vi.fn(),
  preview: vi.fn(() => []), preferences: { volume: 100, blur: 0 },
  t: (key: string) => key,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('antd', () => ({ message: { useMessage: () => [{ error: state.error }, null] } }));
vi.mock('@/lib/i18n/i18n', () => ({ useI18n: () => ({ t: state.t }) }));
vi.mock('@/lib/store', () => ({ useUserStore: Object.assign(() => state.preferences, { setState: vi.fn() }) }));
vi.mock('@/lib/std/device', () => ({ useVideoBlur: () => ({ blurValue: 0, setVideoBlur: state.save }) }));
vi.mock('@livekit/components-react', () => ({
  usePersistentUserChoices: () => ({ userChoices: { username: '', videoEnabled: false, audioEnabled: false,
    videoDeviceId: '', audioDeviceId: '' }, saveAudioInputDeviceId: state.save, saveAudioInputEnabled: state.save,
    saveVideoInputDeviceId: state.save, saveVideoInputEnabled: state.save, saveUsername: state.save }),
  usePreviewTracks: state.preview,
}));
vi.mock('@/features/pre-join/hooks/use-media-permissions', () => ({ useMediaPermissions: () => ({ hasCameraPermission: true, hasMicrophonePermission: true }) }));
vi.mock('@/features/pre-join/validate-pre-join', () => ({ validatePreJoin: state.validate, PreJoinError: class extends Error {} }));
import { usePreJoin } from '@/features/pre-join/hooks/use-pre-join';
import type { ReadableConf } from '@/lib/std/conf';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('preserves actual pre-join controller state across Phone/PC view replacement and prevents duplicate submits', async () => {
  let phone = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return phone; },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb) }));
  const onSubmit = vi.fn();
  let finish!: (value: unknown) => void;
  state.validate.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  function Phone({ model }: { model: ReturnType<typeof usePreJoin> }) {
    return <input aria-label="name" value={model.username} onChange={(e) => model.setUsername(e.target.value)} />;
  }
  function PC({ model }: { model: ReturnType<typeof usePreJoin> }) { return <Phone model={model} />; }
  function Page() {
    const model = usePreJoin({ data: undefined, loading: false, setLoading: vi.fn(), space: 'test', config: {} as ReadableConf, onSubmit });
    return <><span>{model.device}</span>{model.device === 'phone' ? <Phone model={model} /> : <PC model={model} />}
      <button onClick={model.handleSubmit}>join</button></>;
  }
  const view = render(<Page />);
  fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Stage One' } });
  act(() => { phone = false; listeners.forEach((notify) => notify()); });
  expect(screen.getByText('pc')).toBeTruthy();
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('Stage One');
  fireEvent.click(screen.getByText('join'));
  fireEvent.click(screen.getByText('join'));
  expect(state.validate).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ username: 'Stage One' }); });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('join'));
  view.unmount();
  await act(async () => { finish({ username: 'Stage One' }); });
  expect(onSubmit).toHaveBeenCalledTimes(1);
});
