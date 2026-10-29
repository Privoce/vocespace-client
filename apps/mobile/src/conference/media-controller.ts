import type { Analytics } from '@vocespace/client-sdk';
import type { NativeDevice, NativeMediaStatus } from '@vocespace/contracts';

interface Ports {
  analytics?: Analytics;
  status(signal: AbortSignal): Promise<NativeMediaStatus>;
  authorize(
    device: NativeDevice,
    invitationId: string,
    signal: AbortSignal,
  ): Promise<NativeMediaStatus>;
  capture(device: NativeDevice, enabled: boolean): Promise<void>;
  enabled(device: NativeDevice): boolean;
}
export interface MediaState extends NativeMediaStatus {
  microphone: boolean;
  camera: boolean;
  screen: boolean;
  busy?: NativeDevice;
  error?: unknown;
}
/** Owns capture attempts, including permission dialogs that outlive their UI. */
export function createMediaController(ports: Ports) {
  let state: MediaState = {
    sources: [],
    invitations: [],
    microphone: false,
    camera: false,
    screen: false,
  };
  let closed = false;
  let generation = 0;
  let flight: Promise<void> | undefined;
  let refreshId = 0;
  const abort = new AbortController();
  const listeners = new Set<() => void>();
  const update = (next: Partial<MediaState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  const sync = () =>
    update({
      microphone: ports.enabled('microphone'),
      camera: ports.enabled('camera'),
      screen: ports.enabled('screen'),
    });
  async function refresh() {
    const id = ++refreshId;
    try {
      const status = await ports.status(abort.signal);
      if (!closed && id === refreshId) update(status);
    } catch (error) {
      if (!closed && id === refreshId) update({ error });
    }
  }
  async function disableAll() {
    // Try both even when one platform operation fails; propagate failure for cleanup retry.
    const results = await Promise.allSettled(
      ['microphone', 'camera', 'screen'].map((d) => ports.capture(d as NativeDevice, false)),
    );
    sync();
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }
  function setEnabled(device: NativeDevice, enabling: boolean) {
    if (closed || flight) return flight;
    const version = generation;
    if (ports.enabled(device) === enabling) return Promise.resolve();
    const operation = ports.analytics?.begin('media_change', { media_type: device, action: enabling ? 'enable' : 'disable', source: 'meeting' });
    update({ busy: device, error: undefined });
    flight = (async () => {
      try {
        if (enabling) {
          const invitation = state.invitations.find(
            (item) => item.device === device && item.expiresAt > Date.now(),
          );
          const status = await ports.authorize(device, invitation?.id || '', abort.signal);
          if (closed || version !== generation) return;
          ++refreshId;
          update(status);
        }
        if (closed || version !== generation) return;
        await ports.capture(device, enabling);
        // Native permission requests cannot be aborted. Stop any track produced after exit/revoke.
        if (closed || version !== generation) { await ports.capture(device, false); operation?.end('cancelled'); }
        else if (ports.enabled(device) === enabling) operation?.end('success');
        else operation?.end('cancelled');
      } catch (error) {
        operation?.fail(error);
        if (!closed && version === generation) update({ error });
      } finally {
        operation?.end('cancelled');
        sync();
      }
    })().finally(() => {
      flight = undefined;
      update({ busy: undefined });
    });
    return flight;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    sync,
    refresh,
    protected: () =>
      !!flight || ports.enabled('microphone') || ports.enabled('camera') || ports.enabled('screen'),
    toggle: (device: NativeDevice) => setEnabled(device, !ports.enabled(device)),
    accept: (device: NativeDevice) => setEnabled(device, true),
    async revoke(device: NativeDevice) {
      generation++;
      ++refreshId;
      update({
        sources: state.sources.filter((d) => d !== device),
        invitations: state.invitations.filter((i) => i.device !== device),
      });
      try {
        await ports.capture(device, false);
        await flight;
        await ports.capture(device, false);
        sync();
      } catch (error) {
        if (!closed) update({ error });
      }
    },
    async suspendCameraAndMicrophone() {
      await flight;
      await Promise.all([ports.capture('microphone', false), ports.capture('camera', false)]);
      sync();
    },
    async stop() {
      closed = true;
      generation++;
      abort.abort();
      // Stop existing audio immediately even while another device's permission dialog is open.
      // Retry after the pending attempt settles, since it may create a late native track.
      await disableAll().catch(() => {});
      // Wait for an in-flight system permission dialog before releasing the RTC owner.
      await flight;
      await disableAll();
    },
  };
}
