// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { canAcceptNativeInvitation } from '@vocespace/server-core';
import {
  parseNativeMediaRequest,
  parseNativeMediaStatus,
  type NativeDevice,
  type NativeMediaStatus,
} from '@vocespace/contracts';
import { createMediaController } from '../apps/mobile/src/conference/media-controller';
import { createLeaveGuard } from '../apps/mobile/src/conference/leave-guard';
import { withMediaMember } from '../services/api/lib/server/media-lock';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const invitation = {
  id: 'invite-1',
  device: 'microphone' as const,
  senderName: 'Host',
  expiresAt: Date.now() + 60_000,
};
const status: NativeMediaStatus = { sources: [], invitations: [invitation] };
function fixture() {
  const tracks = new Set<NativeDevice>();
  const ports = {
    status: vi.fn(async () => status),
    authorize: vi.fn(
      async (): Promise<NativeMediaStatus> => ({ sources: ['microphone'], invitations: [] }),
    ),
    capture: vi.fn(async (device: NativeDevice, enabled: boolean) => {
      if (enabled) tracks.add(device);
      else tracks.delete(device);
    }),
    enabled: (device: NativeDevice) => tracks.has(device),
  };
  return { tracks, ports, media: createMediaController(ports) };
}
describe('Native media boundary', () => {
  it('rejects unknown sources, malformed IDs and invalid media responses', () => {
    expect(() =>
      parseNativeMediaRequest({
        joinId: 'valid-join-123456',
        device: 'screen_share',
        invitationId: 'x',
      }),
    ).toThrow();
    expect(() =>
      parseNativeMediaRequest({ joinId: 'valid-join-123456', device: 'camera', invitationId: 1 }),
    ).toThrow();
    expect(() => parseNativeMediaStatus({ sources: ['all'], invitations: [] })).toThrow();
    expect(parseNativeMediaStatus({ ...status, secret: 'drop' })).toEqual(status);
  });
  it('requires current manager approval for the exact source, unexpired invitation and ID', () => {
    expect(
      canAcceptNativeInvitation(
        invitation,
        'microphone',
        invitation.id,
        true,
        invitation.expiresAt - 1,
      ),
    ).toBe(true);
    for (const [device, id, manager, now] of [
      ['camera', invitation.id, true, 1],
      ['microphone', 'forged', true, 1],
      ['microphone', invitation.id, false, 1],
      ['microphone', invitation.id, true, invitation.expiresAt],
    ] as const)
      expect(canAcceptNativeInvitation(invitation, device, id, manager, now)).toBe(false);
  });
  it('loading an invitation never opens a device; explicit action authorizes before capture', async () => {
    const { ports, media, tracks } = fixture();
    await media.refresh();
    expect(ports.capture).not.toHaveBeenCalled();
    await media.toggle('microphone');
    expect(tracks.has('microphone')).toBe(true);
    expect(ports.authorize).toHaveBeenCalledWith(
      'microphone',
      invitation.id,
      expect.any(AbortSignal),
    );
    await media.toggle('microphone');
    expect(tracks.size).toBe(0);
    expect(ports.authorize).toHaveBeenCalledTimes(1);
  });
  it('accepting a repeated invitation cannot toggle an already active device off', async () => {
    const { media, tracks, ports } = fixture();
    await media.accept('microphone');
    await media.accept('microphone');
    expect(tracks.has('microphone')).toBe(true);
    expect(ports.authorize).toHaveBeenCalledTimes(1);
  });
  it('denied authorization never starts capture and allows retry', async () => {
    const { media, ports } = fixture();
    ports.authorize.mockRejectedValueOnce(new Error('denied'));
    await media.toggle('microphone');
    expect(ports.capture).not.toHaveBeenCalled();
    expect(media.getSnapshot().error).toBeTruthy();
    expect(media.protected()).toBe(false);
    await media.toggle('microphone');
    expect(media.getSnapshot().microphone).toBe(true);
  });
  it('duplicate taps cannot open a second capture while a system dialog is pending', async () => {
    const { media, ports } = fixture();
    const permission = deferred<void>();
    ports.capture.mockImplementationOnce(() => permission.promise);
    const first = media.toggle('microphone');
    const second = media.toggle('camera');
    expect(first).toBe(second);
    expect(media.protected()).toBe(true);
    await Promise.resolve();
    permission.resolve();
    await first;
    expect(ports.authorize).toHaveBeenCalledTimes(1);
  });
  it('exit during authorization ignores a late successful response', async () => {
    const { media, ports, tracks } = fixture();
    const grant = deferred<NativeMediaStatus>();
    ports.authorize.mockReturnValueOnce(grant.promise);
    const toggle = media.toggle('microphone');
    const stop = media.stop();
    grant.resolve({ sources: ['microphone'], invitations: [] });
    await Promise.all([toggle, stop]);
    expect(tracks.size).toBe(0);
    expect(ports.capture.mock.calls.some(([, enabled]) => enabled)).toBe(false);
  });
  it('exit waits for an uncancellable permission dialog and stops its late track', async () => {
    const { media, ports, tracks } = fixture();
    const permission = deferred<void>();
    ports.capture.mockImplementationOnce(async () => {
      await permission.promise;
      tracks.add('microphone');
    });
    const toggle = media.toggle('microphone');
    await Promise.resolve();
    let stopped = false;
    const stop = media.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    permission.resolve();
    await Promise.all([toggle, stop]);
    expect(tracks.size).toBe(0);
  });
  it('background cleanup stops existing audio while a camera dialog is still pending', async () => {
    const { media, ports, tracks } = fixture();
    tracks.add('microphone');
    const permission = deferred<void>();
    ports.capture.mockImplementationOnce(async () => {
      await permission.promise;
      tracks.add('camera');
    });
    const toggle = media.toggle('camera');
    await Promise.resolve();
    const stop = media.stop();
    await Promise.resolve();
    expect(tracks.has('microphone')).toBe(false);
    permission.resolve();
    await Promise.all([toggle, stop]);
    expect(tracks.size).toBe(0);
  });
  it('a late status read cannot overwrite accepted publishing rights', async () => {
    const { media, ports } = fixture();
    const old = deferred<NativeMediaStatus>();
    ports.status.mockReturnValueOnce(old.promise);
    const refresh = media.refresh();
    await media.toggle('microphone');
    old.resolve(status);
    await refresh;
    expect(media.getSnapshot().sources).toEqual(['microphone']);
  });
  it('host revocation during capture also stops late tracks', async () => {
    const { media, ports, tracks } = fixture();
    const permission = deferred<void>();
    ports.capture.mockImplementationOnce(async () => {
      await permission.promise;
      tracks.add('camera');
    });
    const toggle = media.toggle('camera');
    await Promise.resolve();
    const revoke = media.revoke('camera');
    permission.resolve();
    await Promise.all([toggle, revoke]);
    expect(tracks.size).toBe(0);
  });
  it('failed device cleanup remains observable and can be retried', async () => {
    const { media, ports } = fixture();
    ports.capture.mockRejectedValue(new Error('native stop failed'));
    await expect(media.stop()).rejects.toThrow('native stop failed');
    ports.capture.mockResolvedValue(undefined);
    await expect(media.stop()).resolves.toBeUndefined();
  });
});
describe('protected leave', () => {
  it('cancel keeps the room and duplicate taps share one prompt', async () => {
    const choice = deferred<boolean>();
    const room = {};
    const ports = {
      current: () => room,
      protected: () => true,
      confirm: vi.fn(() => choice.promise),
      leave: vi.fn(async () => true),
    };
    const leave = createLeaveGuard(ports);
    const first = leave();
    expect(leave()).toBe(first);
    choice.resolve(false);
    expect(await first).toBe(false);
    expect(ports.confirm).toHaveBeenCalledTimes(1);
    expect(ports.leave).not.toHaveBeenCalled();
  });
  it('a late confirmation cannot exit a replacement room', async () => {
    const choice = deferred<boolean>();
    let room = {};
    const rawLeave = vi.fn(async () => true);
    const leave = createLeaveGuard({
      current: () => room,
      protected: () => true,
      confirm: () => choice.promise,
      leave: rawLeave,
    });
    const result = leave();
    room = {};
    choice.resolve(true);
    expect(await result).toBe(false);
    expect(rawLeave).not.toHaveBeenCalled();
  });
  it('observers leave immediately without a prompt', async () => {
    const confirm = vi.fn();
    const leave = createLeaveGuard({
      current: () => undefined,
      protected: () => false,
      confirm,
      leave: async () => true,
    });
    expect(await leave()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
  it('serializes grants and revokes per identity and recovers after failure', async () => {
    const pending = deferred<void>();
    const order: string[] = [];
    const grant = withMediaMember('room', 'native', async () => {
      await pending.promise;
      order.push('grant');
      throw new Error('failure');
    });
    const caught = grant.catch(() => {});
    const revoke = withMediaMember('room', 'native', async () => {
      order.push('revoke');
    });
    await withMediaMember('other', 'native', async () => {
      order.push('other');
    });
    expect(order).toEqual(['other']);
    pending.resolve();
    await Promise.all([caught, revoke]);
    expect(order).toEqual(['other', 'grant', 'revoke']);
  });
});

it('screen capture is separately authorized, protected from accidental exit and stopped with all other tracks', async () => {
  const f = fixture();
  f.ports.authorize.mockResolvedValue({ sources: ['screen'], invitations: [] });
  await f.media.accept('screen');
  expect(f.media.getSnapshot().screen).toBe(true);
  expect(f.media.protected()).toBe(true);
  expect(f.tracks).toEqual(new Set(['screen']));
  await f.media.stop();
  expect(f.tracks.size).toBe(0);
});
it('background broadcast suspension stops camera and microphone while preserving authorized screen capture', async () => {
  const f = fixture();
  f.tracks.add('screen'); f.tracks.add('microphone'); f.tracks.add('camera');
  await f.media.suspendCameraAndMicrophone();
  expect(f.tracks).toEqual(new Set(['screen']));
  await f.media.revoke('screen');
  expect(f.tracks.size).toBe(0);
});
