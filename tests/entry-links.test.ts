import { describe, expect, it } from 'vitest';
import { resolveRoomLink, temporaryRoomLink } from '@/features/home/room-link';
import { roomUrlAfterLogin } from '@/features/room/navigation';

describe('entry URLs', () => {
  it('keeps HQ outside the encryption fragment', () => {
    const url = new URL(temporaryRoomLink('test', true, encodeURIComponent('key%hello')), 'https://self.test');
    expect(url.searchParams.get('hq')).toBe('true');
    expect(decodeURIComponent(url.hash.slice(1))).toBe('key%hello');
  });
  it('accepts room names and preserves invitation/query/fragment values', () => {
    expect(resolveRoomLink(' study ', 'https://self.test')).toBe('/study');
    expect(resolveRoomLink('https://self.test/study?hq=true&room=one#key', 'https://self.test')).toBe('/study?hq=true&room=one#key');
    expect(resolveRoomLink('space.voce.chat/chat/study#key', 'https://self.test')).toBe('https://space.voce.chat/chat/study#key');
  });
  it.each(['javascript:alert(1)', 'https://evil.test/room', '//evil.test/room', 'https://user:pass@space.voce.chat/room', '/one/two', ''])('rejects invalid target %s', (value) => {
    expect(resolveRoomLink(value, 'https://self.test')).toBeNull();
  });
  it('removes consumed platform credentials but preserves room/media options', () => {
    expect(roomUrlAfterLogin('study', 'https://self.test/study?auth=space&data=secret&details=token&hq=true&room=one#key'))
      .toBe('/study?hq=true&room=one#key');
  });
});
