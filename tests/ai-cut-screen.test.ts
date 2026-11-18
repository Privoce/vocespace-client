import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AICutService } from '../apps/web/lib/ai/cut';
import type { LocalParticipant } from 'livekit-client';

function participant() {
  const track = { readyState: 'live', muted: false };
  const publication = { isMuted: false, videoTrack: { mediaStreamTrack: track } };
  return { track, publication, local: { getTrackPublication: () => publication } as unknown as LocalParticipant };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('does not start without an active shared screen', async () => {
  const service = new AICutService();
  const { local, track } = participant();
  track.readyState = 'ended';
  const analyze = vi.fn();
  await service.start(1, false, local, false, analyze);
  await vi.advanceTimersByTimeAsync(600000);
  expect(service.isRunning).toBe(false);
  expect(analyze).not.toHaveBeenCalled();
});

it('uses an existing screen and never analyzes a failed capture or an old screenshot', async () => {
  const service = new AICutService();
  const { local } = participant();
  const shot = { data: 'data:image/jpeg;base64,test', timestamp: 1, showTime: false };
  const capture = vi.spyOn(service, 'captureFromChannel').mockResolvedValueOnce(shot).mockResolvedValue(null);
  const analyze = vi.fn();
  await service.start(1, false, local, false, analyze);
  await vi.advanceTimersByTimeAsync(120000);
  expect(capture).toHaveBeenCalledTimes(2);
  expect(analyze).toHaveBeenCalledExactlyOnceWith(shot);
  service.stop();
});

it('stops when sharing ends and cancels the four-minute capture on stop', async () => {
  const service = new AICutService();
  const { local, track } = participant();
  const capture = vi.spyOn(service, 'captureFromChannel').mockResolvedValue(null);
  await service.start(10, false, local);
  service.stop();
  await vi.advanceTimersByTimeAsync(600000);
  expect(capture).not.toHaveBeenCalled();
  await service.start(1, false, local);
  track.readyState = 'ended';
  await vi.advanceTimersByTimeAsync(60000);
  expect(service.isRunning).toBe(false);
  expect(capture).not.toHaveBeenCalled();
});

it('discards a capture that finishes after stop or restart', async () => {
  const service = new AICutService();
  const { local } = participant();
  let resolve!: (value: any) => void;
  vi.spyOn(service, 'captureFromChannel').mockImplementation(() => new Promise(r => { resolve = r; }));
  const analyze = vi.fn();
  await service.start(1, false, local, false, analyze);
  await vi.advanceTimersByTimeAsync(60000);
  service.stop();
  resolve({ data: 'old', timestamp: 1, showTime: false });
  await Promise.resolve();
  expect(analyze).not.toHaveBeenCalled();
});

it('reads an already published screen and releases the temporary video without stopping the track', async () => {
  const service = new AICutService();
  const { local, track } = participant();
  const stop = vi.fn();
  Object.assign(track, { stop });
  const video = {
    muted: false, playsInline: false, srcObject: null, readyState: 2,
    videoWidth: 1280, videoHeight: 720, play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(), onloadeddata: null,
  };
  const drawImage = vi.fn();
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL: () => 'data:image/jpeg;base64,screen' };
  vi.stubGlobal('MediaStream', class { constructor(public tracks: unknown[]) {} });
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => tag === 'video' ? video : canvas) as any);
  service.localParicipant = local;
  const shot = await service.captureFromChannel();
  expect(shot?.data).toBe('data:image/jpeg;base64,screen');
  expect(drawImage).toHaveBeenCalled();
  expect(video.muted).toBe(true);
  expect(video.srcObject).toBeNull();
  expect(video.pause).toHaveBeenCalled();
  expect(stop).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
