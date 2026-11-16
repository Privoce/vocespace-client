import type { createMediaController } from './media-controller';
type Media = ReturnType<typeof createMediaController>;

/** One decision path for AppState, media changes and native dialog completion. */
export function createConferenceBackgroundPolicy(ports: {
  background(): boolean;
  systemInteraction(): boolean;
  media(): Media | undefined;
  leave(): Promise<unknown>;
}) {
  let disposed = false;
  let suspended: Media | undefined;
  let leaving = false;
  const leave = () => {
    if (disposed || leaving) return;
    leaving = true;
    void ports.leave().finally(() => {
      leaving = false;
    });
  };
  return {
    check() {
      if (disposed) return;
      if (!ports.background()) {
        suspended = undefined;
        return;
      }
      if (ports.systemInteraction()) return;
      const media = ports.media();
      const current = media?.getSnapshot();
      if (media?.isScreenSharing() || current?.screen || current?.busy === 'screen') {
        if (suspended === media) return;
        suspended = media;
        void media!.suspendCameraAndMicrophone().catch(() => {
          if (!disposed && ports.background() && ports.media() === media) leave();
        });
      } else leave();
    },
    dispose() {
      disposed = true;
    },
  };
}
