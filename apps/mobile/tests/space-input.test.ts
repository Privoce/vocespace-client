import { describe, expect, it } from 'vitest';
import { resolveSpaceInput } from '../src/conference/space-input';

describe('home meeting input', () => {
  const api = 'https://meet.example.com/chat';
  it('accepts names and decodes meeting links without switching the API', () => {
    expect(resolveSpaceInput(' mobile-test ', api)).toBe('mobile-test');
    expect(resolveSpaceInput('https://meet.example.com/chat/%E4%BC%9A%E8%AE%AE?hq=true', api)).toBe('会议');
    expect(resolveSpaceInput('vocespace.com/mobile-test', api)).toBe('mobile-test');
    expect(resolveSpaceInput('/chat/mobile-test/', api)).toBe('mobile-test');
  });
  it('rejects unrelated servers, credentials, invalid paths and unsupported encryption', () => {
    for (const input of [
      '', 'https://other.example.com/room', 'https://user:pass@meet.example.com/room',
      'javascript:alert(1)', 'https://meet.example.com/a/b',
      'https://meet.example.com/a%2Fb', 'https://meet.example.com/%ZZ',
      'https://meet.example.com/room#encryption-key', '__proto__', 'a'.repeat(201),
    ]) expect(resolveSpaceInput(input, api)).toBeNull();
  });
});
