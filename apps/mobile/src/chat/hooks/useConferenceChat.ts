import { analytics } from '../../analytics';
import { useEffect, useState, useSyncExternalStore } from 'react';
import * as Crypto from 'expo-crypto';
import type { createNativeApi } from '../../api/session';
import { createChatController, type ChatMeeting } from '../controller';

export function useConferenceChat(
  api: ReturnType<typeof createNativeApi> | undefined,
  meeting?: ChatMeeting,
) {
  const [controller] = useState(() =>
    createChatController({
      analytics,
      socket: (joinId) => api!.createChatSocket(joinId),
      history: (joinId, signal) => api!.sdk.native.chatHistory(joinId, signal),
      newId: () => Crypto.randomUUID(),
    }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    if (api && meeting) controller.start(meeting);
    return controller.stop;
  }, [api, controller, meeting]);
  return {
    state,
    onControl: controller.onControl,
    raise: controller.raise,
    setDraft: controller.setDraft,
    send: controller.send,
    refresh: controller.refresh,
    reconnect: controller.reconnect,
  };
}
