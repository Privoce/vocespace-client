// @vitest-environment node
import { expect, it } from 'vitest';
import { previewMembers, previewAssetName, rewritePreviewPlaylist } from '@vocespace/server-core';
import { parseNativePreview } from '@vocespace/contracts';
it('previews only the main Space, excluding both public and private child Rooms', () => {
  const space = {
    allowGuest: 'allow',
    participants: { host: { name: 'Host' }, publicChild: {}, privateChild: {} },
    children: [{ participants: ['publicChild'] }, { participants: ['privateChild'] }],
  };
  expect(previewMembers(space)).toEqual([{ id: 'host', name: 'Host' }]);
  expect(previewMembers({ ...space, allowGuest: 'link' })).toBeNull();
  expect(previewMembers({ ...space, children: undefined as never })).toBeNull();
  space.children[0].participants.push('host');
  expect(previewMembers(space)).toEqual([]);
});
it('keeps every nested playlist and segment behind the same lease, rejects path and remote escapes', () => {
  expect(
    rewritePreviewPlaylist(
      '#EXTM3U\n#EXTINF:2,\nsegment_001.ts\n#EXT-X-MAP:URI="init.mp4"',
      (name) => `/protected/${name}`,
    ),
  ).toBe('#EXTM3U\n#EXTINF:2,\n/protected/segment_001.ts\n#EXT-X-MAP:URI="/protected/init.mp4"');
  for (const input of [
    '../secret.ts',
    'https://other.test/a.ts',
    '//other.test/a.ts',
    'a.ts?key=other',
    'a%2fb.ts',
    'a\\b.ts',
  ]) {
    expect(previewAssetName(input)).toBe(false);
    expect(() => rewritePreviewPlaylist(`#EXTM3U\n${input}`, (name) => name)).toThrow();
  }
  expect(() =>
    rewritePreviewPlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"', (name) => name),
  ).toThrow();
});
it('validates ready preview DTOs and preserves unavailable responses', () => {
  expect(parseNativePreview({ status: 'unavailable' })).toEqual({ status: 'unavailable' });
  expect(() =>
    parseNativePreview({ status: 'ready', leaseId: 'x', url: 'file://secret', expiresAt: 1 }),
  ).toThrow();
});
