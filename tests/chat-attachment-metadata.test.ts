import { expect, it } from 'vitest';
import { parseConferenceMessage } from '@vocespace/contracts';

it('preserves attachment metadata through repeated parsing without exposing legacy URLs', () => {
  const value = { id: 'm', roomName: 'room', sender: { id: 'user', name: 'User' }, timestamp: 1,
    type: 'file', message: null, file: { name: 'photo.jpg', type: 'image/jpeg', url: '/uploads/room/stored.jpg?token=secret' } };
  const parsed = parseConferenceMessage(value);
  expect(parsed.file).toEqual({ name: 'photo.jpg', type: 'image/jpeg', storageName: 'stored.jpg' });
  expect(parseConferenceMessage(parsed)).toEqual(parsed);
  expect(JSON.stringify(parsed)).not.toContain('secret');
  expect(parseConferenceMessage({ ...value, file: { ...value.file, storageName: '../private' } }).file).toBeUndefined();
});

it('does not invent a download name for legacy messages with no URL', () => {
  const value = { id: 'm', roomName: 'room', sender: { id: 'user', name: 'User' }, timestamp: 1,
    type: 'file', message: null, file: { name: 'missing.pdf' } };
  expect(parseConferenceMessage(value).file).toBeUndefined();
});
