// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseNativeSettingsPatch, parseNativeSettingsSnapshot } from '@vocespace/contracts';
import { DEFAULT_PARTICIPANT_SETTINGS, DEFAULT_SPACE_AUTH_CONF } from '@vocespace/domain/space';
const snapshot = parseNativeSettingsSnapshot({
  ...DEFAULT_PARTICIPANT_SETTINGS,
  name: 'Ada',
  permissions: DEFAULT_SPACE_AUTH_CONF,
});
describe('Native preference writes', () => {
  it('projects a bounded patch without overwriting unrelated fields', () => {
    expect(
      parseNativeSettingsPatch({ status: 'Working', volume: 40, appAuth: 'write' }, snapshot),
    ).toEqual({ status: 'Working', volume: 40, appAuth: 'write' });
    expect(
      parseNativeSettingsPatch({ apps: ['timer', 'timer'], allowGuest: 'link' }, snapshot),
    ).toEqual({ apps: ['timer'], allowGuest: 'link' });
  });
  it('rejects invalid values and attempted role/member/deployment changes', () => {
    for (const patch of [
      null,
      [],
      {},
      { name: '' },
      { name: 'a'.repeat(81) },
      { volume: 101 },
      { volume: NaN },
      { status: 'a'.repeat(101) },
      { permissions: {} },
      { allowGuest: true },
      { persistence: 1 },
      { apps: ['unknown'] },
      { auth: { identity: 'owner' } },
      { ownerId: 'attacker' },
      { participants: {} },
      { room: { isOwner: true } },
      { ai: { key: 'secret' } },
      { socketId: 'forged' },
      { audioProcessing: { noiseSuppression: true } },
      { avoList: Array(31).fill(snapshot.avoList[0]) },
      { virtual: null },
    ])
      expect(() => parseNativeSettingsPatch(patch, snapshot)).toThrow();
  });
  it('does not return hidden fields nested in preferences', () => {
    const value = parseNativeSettingsPatch(
      { audioProcessing: { ...snapshot.audioProcessing, secret: 'hidden' } },
      snapshot,
    );
    expect(value.audioProcessing).toEqual(snapshot.audioProcessing);
  });
});
