import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@vocespace/client-sdk';
const fake = vi.hoisted(() => ({
  model: {} as any,
  toast: vi.fn(),
  toggle: vi.fn(),
  t: (key: string) => key,
}));
vi.mock('../src/analytics', () => ({ analytics: { track: vi.fn() } }));
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: fake.t }) }));
vi.mock('react-native', () => ({
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  Clipboard: {},
}));
vi.mock('@livekit/react-native', () => ({ isTrackReference: () => false }));
vi.mock('@ant-design/react-native/lib/toast', () => ({
  default: { info: fake.toast, remove: vi.fn() },
}));
vi.mock('../src/conference/hooks/useMeetingRoom', () => ({ useMeetingRoom: () => fake.model }));
vi.mock('../src/conference/hooks/useRoomSettings', () => ({
  useRoomSettings: () => ({ t: fake.t }),
}));
import { useSharedMeetingRoom } from '../src/conference/hooks/useSharedMeetingRoom';
import { createMediaController } from '../src/conference/media-controller';
afterEach(cleanup);
it('keeps guest controls actionable, shows authorization errors, and indicates pending capture', () => {
  fake.model = {
    connection: 'connected',
    allTracks: [],
    participants: [],
    panel: 'stage',
    invitations: [],
    media: { sources: [], microphone: false, camera: false, screen: false },
    toggle: fake.toggle,
  };
  const conference = { state: {}, chat: { state: { connection: 'connected' } } } as any;
  const room = { raw: { name: 'demo' } } as any;
  const view = renderHook(() => useSharedMeetingRoom(conference, room));
  const mic = view.result.current.actions.find((a) => a.id === 'microphone')!;
  expect(mic.disabled).toBe(false);
  act(() => mic.onPress());
  expect(fake.toggle).toHaveBeenCalledWith('microphone');
  fake.model.media = { ...fake.model.media, busy: 'microphone' };
  view.rerender();
  expect(view.result.current.actions[0].loading).toBe(true);
  expect(view.result.current.actions[1].disabled).toBe(true);
  fake.model.media = {
    ...fake.model.media,
    busy: undefined,
    error: new ApiError(403, 'MEDIA_INVITATION_REQUIRED', 'denied'),
  };
  view.rerender();
  expect(fake.toast).toHaveBeenCalledWith('native_settings.media_hint', 3, undefined, false);
  expect(view.result.current.actions[0].disabled).toBe(false);
});
it('never captures without server authorization and can retry after a host invitation', async () => {
  let enabled = false;
  const denied = new ApiError(403, 'MEDIA_INVITATION_REQUIRED', 'denied');
  const authorize = vi
    .fn()
    .mockRejectedValueOnce(denied)
    .mockResolvedValue({ sources: ['microphone'], invitations: [] });
  const capture = vi.fn(async (_device, value) => {
    enabled = value;
  });
  const controller = createMediaController({
    status: async () => ({ sources: [], invitations: [] }),
    authorize,
    capture,
    enabled: () => enabled,
  });
  await controller.toggle('microphone');
  expect(capture).not.toHaveBeenCalled();
  expect(controller.getSnapshot().error).toBe(denied);
  await controller.toggle('microphone');
  expect(capture).toHaveBeenCalledWith('microphone', true);
  expect(controller.getSnapshot()).toMatchObject({
    microphone: true,
    busy: undefined,
    error: undefined,
  });
});
