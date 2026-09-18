import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/i18n/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
import { useMediaPermissions } from '@/features/pre-join/hooks/use-media-permissions';
import type { MessageInstance } from 'antd/es/message/interface';

const enumerateDevices = vi.fn();
const getUserMedia = vi.fn();
const microphone = vi.fn();
const camera = vi.fn();
const messageApi = { success: vi.fn(), error: vi.fn() } as unknown as MessageInstance;
beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices, getUserMedia } });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
  enumerateDevices.mockResolvedValue([{ kind: 'videoinput' }, { kind: 'audioinput' }]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const usePermissions = () => useMediaPermissions({ setAudioEnabled: microphone, setVideoEnabled: camera, messageApi });

it('allows dismissing permission prompts and disables unavailable publication', async () => {
  const { result } = renderHook(usePermissions);
  await waitFor(() => expect(result.current.permissionModalVisible).toBe(true));
  act(() => result.current.continueWithoutPermissions());
  expect(camera).toHaveBeenCalledWith(false);
  expect(microphone).toHaveBeenCalledWith(false);
  expect(getUserMedia).not.toHaveBeenCalled();
});
it('stops permission probe tracks and does not reprompt on browsers without Permissions API', async () => {
  const stop = vi.fn();
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }, { stop }] });
  const { result } = renderHook(usePermissions);
  await waitFor(() => expect(result.current.permissionModalVisible).toBe(true));
  await act(async () => { await result.current.requestMediaPermissions(); });
  expect(stop).toHaveBeenCalledTimes(2);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(result.current.hasCameraPermission).toBe(true);
  expect(result.current.hasMicrophonePermission).toBe(true);
  expect(result.current.permissionModalVisible).toBe(false);
});
it('handles a rejected media request and leaves the user able to continue', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
  const { result } = renderHook(usePermissions);
  await waitFor(() => expect(result.current.permissionModalVisible).toBe(true));
  await act(async () => { await result.current.requestMediaPermissions(); });
  expect(messageApi.error).toHaveBeenCalled();
  expect(result.current.hasCameraPermission).toBe(false);
  act(() => result.current.continueWithoutPermissions());
  expect(result.current.permissionModalVisible).toBe(false);
});
