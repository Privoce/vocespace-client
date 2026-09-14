import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { LocalAudioTrack } from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import { DevicesSelector } from '@/lib/livekit';
import { MediaDeviceKind } from '@/lib/livekit/devices';

const { room } = vi.hoisted(() => ({ room: {
  getActiveDevice: vi.fn(() => 'a'), switchActiveDevice: vi.fn(), emit: vi.fn(),
} }));
vi.mock('@livekit/components-react', () => ({ useMaybeRoomContext: () => room }));

let media: {
  enumerateDevices: ReturnType<typeof vi.fn>;
  getUserMedia: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  room.switchActiveDevice.mockResolvedValue(true);
  media = {
    enumerateDevices: vi.fn().mockResolvedValue([
      { kind: 'audioinput', deviceId: 'a', label: 'Mic A' },
      { kind: 'audioinput', deviceId: 'b', label: 'Mic B' },
      { kind: 'audioinput', deviceId: 'default', label: 'Default' },
      { kind: 'videoinput', deviceId: 'cam', label: 'Camera' },
      { kind: 'audioinput', deviceId: '', label: 'Hidden' },
    ]),
    getUserMedia: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  };
  vi.stubGlobal('navigator', { userAgent: 'Test desktop', mediaDevices: media });
});

it('filters devices and honors a saved device without requesting permission again', async () => {
  render(<DevicesSelector enabled kind={MediaDeviceKind.AudioInput} preferredDeviceId="b" requestPermissions={false} />);
  await flush();
  expect(screen.getAllByRole('button')).toHaveLength(3);
  expect(screen.queryByText('Camera')).toBeNull();
  expect(screen.getByRole('button', { name: 'Mic B' }).getAttribute('aria-pressed')).toBe('true');
  expect(media.getUserMedia).not.toHaveBeenCalled();
});

it('switches a provided local track and reports the confirmed selection', async () => {
  const track = { setDeviceId: vi.fn().mockResolvedValue(true) };
  const changed = vi.fn();
  render(<DevicesSelector enabled kind={MediaDeviceKind.AudioInput} requestPermissions={false} track={track as unknown as LocalAudioTrack} onDeviceChanged={changed} />);
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Mic B' }));
  await flush();
  expect(track.setDeviceId).toHaveBeenCalledWith({ exact: 'b' });
  expect(changed).toHaveBeenCalledWith('b');
  expect(room.switchActiveDevice).not.toHaveBeenCalled();
});

it('uses the room when no track exists and preserves default-device semantics', async () => {
  render(<DevicesSelector enabled kind={MediaDeviceKind.AudioInput} requestPermissions={false} />);
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Default' }));
  await flush();
  expect(room.switchActiveDevice).toHaveBeenCalledWith('audioinput', 'default', false);
});

it('stops permission-probe tracks and releases all refresh listeners/timers on unmount', async () => {
  const stop = vi.fn();
  media.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
  const view = render(<DevicesSelector enabled kind={MediaDeviceKind.AudioInput} />);
  await flush();
  expect(stop).toHaveBeenCalledOnce();
  const handler = media.addEventListener.mock.calls[0][1];
  const enumerations = media.enumerateDevices.mock.calls.length;
  view.unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith('devicechange', handler);
  await act(async () => { vi.advanceTimersByTime(10000); });
  fireEvent.focus(window);
  fireEvent(document, new Event('visibilitychange'));
  await flush();
  expect(media.enumerateDevices).toHaveBeenCalledTimes(enumerations);
  expect(vi.getTimerCount()).toBe(0);
});

it('reports rejected permissions without emitting a successful device change', async () => {
  const error = new DOMException('Denied', 'NotAllowedError');
  media.getUserMedia.mockRejectedValue(error);
  const onError = vi.fn();
  const changed = vi.fn();
  render(<DevicesSelector enabled kind={MediaDeviceKind.AudioInput} err={onError} onDeviceChanged={changed} />);
  await flush();
  expect(onError).toHaveBeenCalledWith(error);
  expect(room.emit).toHaveBeenCalledWith(RoomEvent.MediaDevicesError, error);
  expect(changed).not.toHaveBeenCalled();
  expect(media.enumerateDevices).not.toHaveBeenCalled();
});

it('does not start discovery or timers while disabled', async () => {
  render(<DevicesSelector enabled={false} kind={MediaDeviceKind.AudioInput} />);
  await flush();
  expect(media.enumerateDevices).not.toHaveBeenCalled();
  expect(media.getUserMedia).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
