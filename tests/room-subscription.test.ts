import { act, renderHook } from '@testing-library/react';
import { ConnectionState, Track, type Room } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';

// Isolate the transport boundary: importing the real page would auto-connect a Socket.
// The hook and LiveKit enum values remain real; this is not a media integration test.
const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock('@/app/[spaceName]/PageClientImpl', () => ({ socket: { emit } }));
import { useRoomSubscription } from '@/app/pages/controls/hooks/use-room-subscription';

function fixture() {
  const member = { identity: 'member', setVolume: vi.fn() };
  const outside = { identity: 'outside', setVolume: vi.fn() };
  const setPermissions = vi.fn();
  const room = {
    name: 'test-space', state: ConnectionState.Connected,
    localParticipant: {
      identity: 'local', setTrackSubscriptionPermissions: setPermissions,
      getTrackPublication: vi.fn((source: Track.Source) => {
        if (source === Track.Source.Camera) return { trackSid: 'camera-track' };
        if (source === Track.Source.ScreenShare) return { trackSid: 'screen-track' };
        return undefined;
      }),
    },
    remoteParticipants: new Map([['member', member], ['outside', outside]]),
  };
  const options = {
    space: room as unknown as Room,
    settings: { participants: { local: { screenShareVolumes: { member: 0 } }, member: { volume: 30 } } },
    selfRoom: { name: 'channel', participants: ['local', 'member'], ownerId: 'local', isPrivate: true },
    freshPermission: false, localTrackVersion: 0, fetchSettings: vi.fn(async () => {}),
  };
  return { room, member, outside, setPermissions, options };
}

describe('current channel subscription policy', () => {
  it('does nothing without a connected Room', () => {
    const { options, room, setPermissions } = fixture();
    room.state = ConnectionState.Disconnected;
    renderHook(() => useRoomSubscription(options));
    expect(setPermissions).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does nothing until a channel is selected', () => {
    const { options, setPermissions } = fixture();
    renderHook(() => useRoomSubscription({ ...options, selfRoom: undefined }));
    expect(setPermissions).not.toHaveBeenCalled();
  });

  it('allows all tracks in-channel and only camera/screen tracks outside', () => {
    const { options, setPermissions, member, outside } = fixture();
    renderHook(() => useRoomSubscription(options));
    expect(setPermissions).toHaveBeenCalledWith(false, [
      { participantIdentity: 'member', allowAll: true },
      { participantIdentity: 'outside', allowAll: false, allowedTrackSids: ['camera-track', 'screen-track'] },
    ]);
    expect(member.setVolume).toHaveBeenCalledWith(0.3);
    expect(member.setVolume).toHaveBeenCalledWith(0, Track.Source.ScreenShareAudio);
    expect(outside.setVolume).not.toHaveBeenCalled();
    expect(options.fetchSettings).not.toHaveBeenCalled();
  });

  it('refreshes permission data before requesting a status broadcast', async () => {
    const { options } = fixture();
    let finish!: () => void;
    options.fetchSettings = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderHook(() => useRoomSubscription({ ...options, freshPermission: true }));
    expect(options.fetchSettings).toHaveBeenCalledOnce();
    expect(emit).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(emit).toHaveBeenCalledExactlyOnceWith('update_user_status', { space: 'test-space' });
  });
});
