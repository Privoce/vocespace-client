import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ConnectionState, Track, type Room } from 'livekit-client';
vi.mock('../apps/web/lib/realtime/socket', () => ({ socket: { emit: vi.fn() } }));
import { useRoomSubscription } from '@/components/Controller/hooks/useRoomSubscription';

it('denies every private-room track to Native viewers while retaining Web subscriptions', () => {
  const update = vi.fn();
  const remote = (identity: string) => ({ identity, setVolume: vi.fn() });
  const native = remote('native_guest');
  const web = remote('web_guest');
  const room = {
    name: 'space',
    state: ConnectionState.Connected,
    localParticipant: {
      identity: 'host',
      getTrackPublication: (source: string) => ({
        trackSid: source === Track.Source.Camera ? 'camera' : 'screen',
      }),
      setTrackSubscriptionPermissions: update,
    },
    remoteParticipants: new Map([
      [native.identity, native],
      [web.identity, web],
    ]),
  } as unknown as Room;
  const base = {
    space: room,
    settings: { participants: {} },
    freshPermission: false,
    localTrackVersion: 1,
    fetchSettings: vi.fn(),
    selfRoom: { name: 'personal', participants: ['host'], ownerId: 'host', isPrivate: true },
  };
  const { rerender } = renderHook((props) => useRoomSubscription(props), { initialProps: base });
  expect(update).toHaveBeenLastCalledWith(false, [
    { participantIdentity: 'preview_main', allowAll: false, allowedTrackSids: [] },
    { participantIdentity: native.identity, allowAll: false, allowedTrackSids: [] },
    { participantIdentity: web.identity, allowAll: false, allowedTrackSids: ['camera', 'screen'] },
  ]);
  rerender({
    ...base,
    selfRoom: { ...base.selfRoom, isPrivate: false, participants: ['host', native.identity] },
  });
  expect(update.mock.lastCall?.[1]).toContainEqual({
    participantIdentity: native.identity,
    allowAll: true,
  });
  expect(update.mock.lastCall?.[1]).toContainEqual({
    participantIdentity: 'preview_main', allowAll: false, allowedTrackSids: [],
  });
  rerender({ ...base, selfRoom: { ...base.selfRoom, name: 'space', isPrivate: false } });
  expect(update.mock.lastCall?.[1]).toContainEqual({
    participantIdentity: 'preview_main', allowAll: true, allowedTrackSids: [],
  });
});
