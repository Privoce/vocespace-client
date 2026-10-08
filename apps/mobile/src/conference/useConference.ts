import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { createConfiguredApi } from '../api';
import { createConferenceController } from './controller';
import { NativeRoom } from './room';

export function useConference() {
  const [api] = useState(createConfiguredApi);
  const [controller] = useState(() =>
    createConferenceController({
      ensureSession: async () => {
        if (!api) throw new Error('SERVICE_NOT_CONFIGURED');
        await api.ensureSession();
      },
      prepare: (spaceName, nickname, joinId, signal) =>
        api!.sdk.native.prepare({ spaceName, nickname, joinId }, signal),
      confirm: (id, signal) => api!.sdk.native.confirm(id, signal),
      leave: (id) => api!.sdk.native.leave(id),
      createRoom: (onDisconnected) => new NativeRoom(onDisconnected),
      newId: () => Crypto.randomUUID(),
    }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => {
      // This first Native flow is observer-only; backgrounding ends observation.
      if (next !== 'active') void controller.leave();
    });
    return () => {
      listener.remove();
      void controller.leave();
    };
  }, [controller]);
  return {
    state,
    configured: !!api,
    hasPendingCleanup: controller.hasPendingCleanup(),
    join: controller.join,
    leave: controller.leave,
  };
}
