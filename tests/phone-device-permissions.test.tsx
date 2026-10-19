import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Track } from 'livekit-client';
const state = vi.hoisted(() => ({
  permissions: { canPublish: false, canPublishSources: [] as number[] },
  toggle: vi.fn(),
  audio: vi.fn(),
  video: vi.fn(),
}));
vi.mock('../apps/web/node_modules/@livekit/components-react', () => ({
  useLocalParticipantPermissions: () => state.permissions,
  useTrackToggle: () => ({ enabled: false, pending: false, toggle: state.toggle }),
  usePersistentUserChoices: () => ({
    saveAudioInputEnabled: state.audio,
    saveVideoInputEnabled: state.video,
  }),
}));
vi.mock('../apps/web/lib/i18n/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
import { PhoneDeviceSwitch } from '../apps/web/components/Settings/panels/PhoneDeviceSwitch';
import type { MessageInstance } from 'antd/es/message/interface';
const error = vi.fn();
const messageApi = { error } as unknown as MessageInstance;
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('Phone permission controls', () => {
  it('cannot enable a source excluded by the RTC permission', () => {
    state.permissions = {
      canPublish: true,
      canPublishSources: [Track.sourceToProto(Track.Source.Microphone)],
    };
    render(<PhoneDeviceSwitch device="camera" messageApi={messageApi} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(state.toggle).not.toHaveBeenCalled();
  });
  it('captures only after an allowed explicit press and persists the successful preference', async () => {
    state.permissions = {
      canPublish: true,
      canPublishSources: [Track.sourceToProto(Track.Source.Microphone)],
    };
    state.toggle.mockResolvedValue(true);
    render(<PhoneDeviceSwitch device="microphone" messageApi={messageApi} />);
    expect(state.toggle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(state.audio).toHaveBeenCalledWith(true));
    expect(state.video).not.toHaveBeenCalled();
  });
  it('does not persist an unsuccessful device request', async () => {
    state.permissions = { canPublish: true, canPublishSources: [] };
    state.toggle.mockRejectedValue(new Error('device unavailable'));
    render(<PhoneDeviceSwitch device="camera" messageApi={messageApi} />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(state.video).not.toHaveBeenCalled();
  });
});
