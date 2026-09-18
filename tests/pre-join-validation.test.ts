import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api', () => ({ api: {} }));
import { validatePreJoin } from '@/features/pre-join/validate-pre-join';
import type { api } from '@/lib/api';
const input = { space: 'room', username: 'Alice', videoEnabled: false, audioEnabled: false, videoDeviceId: '', audioDeviceId: '' };
const response = (data: object, status = 200) => new Response(JSON.stringify(data), { status });
const client = {
  checkUsername: vi.fn(), getUniqueUsername: vi.fn(), getSpaceInfo: vi.fn(),
};
const validate = (values = input) => validatePreJoin(values, client as unknown as typeof api);
beforeEach(() => {
  client.checkUsername.mockImplementation(async () => response({ success: true, name: 'Alice' }));
  client.getUniqueUsername.mockResolvedValue(response({ name: 'Guest' }));
  client.getSpaceInfo.mockResolvedValue(response({ settings: { allowGuest: 'allow' } }));
});
it('uses the explicit space rather than query/hash text from the URL', async () => {
  history.replaceState({}, '', '/room?hq=true#key');
  expect((await validate()).username).toBe('Alice');
  expect(client.checkUsername).toHaveBeenCalledWith('room', 'Alice', undefined);
});
it('generates a name for an empty or whitespace-only input', async () => {
  expect((await validate({ ...input, username: '  ' })).username).toBe('Guest');
});
it('stops when the username request fails', async () => {
  client.checkUsername.mockResolvedValue(response({}, 500));
  await expect(validate()).rejects.toThrow('msg.error.user.username.request');
  expect(client.getSpaceInfo).not.toHaveBeenCalled();
});
it('stops for a duplicate username', async () => {
  client.checkUsername.mockResolvedValue(response({ success: false, name: 'Alice' }));
  await expect(validate()).rejects.toThrow('msg.error.user.username.exist');
});
it('blocks disabled guests without breaking existing invitation mode', async () => {
  client.getSpaceInfo.mockResolvedValueOnce(response({ settings: { allowGuest: 'disable' } }));
  await expect(validate()).rejects.toThrow('common.guest.not_allow');
  client.getSpaceInfo.mockResolvedValueOnce(response({ settings: { allowGuest: 'link' } }));
  await expect(validate()).resolves.toMatchObject({ username: 'Alice' });
});
