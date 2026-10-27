import { sendFeedback, type FeedbackBody } from '../../feedback/client';
import { atJoinStage } from '../join-error';
import { useI18n } from '../../i18n';
import { useCallback, useEffect, useState, useSyncExternalStore, useRef } from 'react';
import { Alert, AppState, BackHandler } from 'react-native';
import * as Crypto from 'expo-crypto';
import { createConfiguredApi } from '../../api';
import { createConferenceController } from '../controller';
import { createLeaveGuard } from '../leave-guard';
import { NativeRoom } from '../room';
import { useConferenceChat } from '../../chat/hooks/useConferenceChat';

export function useConference() {
  const { t } = useI18n();
  const translate = useRef(t);
  translate.current = t;
  const [api] = useState(createConfiguredApi);
  const [controller] = useState(() =>
    createConferenceController({
      ensureSession: async () => {
        if (!api) throw new Error('SERVICE_NOT_CONFIGURED');
        await api.ensureSession();
      },
      prepare: async (spaceName, nickname, joinId, signal, childRoom, createIfMissing) => {
        if (createIfMissing)
          await atJoinStage('create', () => api!.sdk.native.createSpace(spaceName, signal));
        return api!.sdk.native.prepare({ spaceName, nickname, joinId, childRoom }, signal);
      },
      confirm: (id, signal) => api!.sdk.native.confirm(id, signal),
      leave: (id) => api!.sdk.native.leave(id),
      createRoom: (onDisconnected) => new NativeRoom(onDisconnected, api!),
      newId: () => Crypto.randomUUID(),
    }),
  );
  const [leave] = useState(() =>
    createLeaveGuard({
      current: () => controller.getSnapshot().room,
      protected: () =>
        !!controller.getSnapshot().room?.isOwner ||
        !!controller.getSnapshot().room?.media.protected(),
      leave: controller.leave,
      confirm: () =>
        new Promise<boolean>((resolve) =>
          Alert.alert(
            '退出会议？',
            controller.getSnapshot().room?.isOwner
              ? translate.current('native_settings.owner_leave_confirm')
              : '你正在开启或使用麦克风、摄像头或屏幕共享。退出会停止发布。',
            [
              { text: '继续会议', style: 'cancel', onPress: () => resolve(false) },
              { text: '退出会议', style: 'destructive', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          ),
        ),
    }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const chat = useConferenceChat(api, state.phase === 'joined' ? state.joined : undefined);
  const { onControl } = chat;
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => {
      // iOS permission dialogs are inactive, not background. Actual background still exits.
      if (next === 'background') {
        const media = controller.getSnapshot().room?.media;
        const current = media?.getSnapshot();
        if (current?.screen || current?.busy === 'screen') {
          void media!.suspendCameraAndMicrophone().catch(() => controller.leave());
        } else void controller.leave();
      }
    });
    return () => {
      listener.remove();
      void controller.leave();
    };
  }, [controller]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!controller.hasPendingCleanup()) return false;
      void leave();
      return true;
    });
    return () => back.remove();
  }, [controller, leave]);
  useEffect(() => {
    if (state.phase !== 'joined' || !state.room) return;
    const media = state.room.media;
    return media.subscribe(() => {
      const current = media.getSnapshot();
      if (
        controller.getSnapshot().phase === 'joined' &&
        AppState.currentState === 'background' &&
        !current.screen &&
        current.busy !== 'screen'
      )
        void controller.leave();
    });
  }, [controller, state.phase, state.room]);
  useEffect(() => {
    if (state.phase !== 'joined' || !state.room) return;
    const media = state.room.media;
    return onControl((event, value) => {
      if (event === 'invitation') void media.refresh();
      if (event === 'revoked') {
        const device = (value as { device?: unknown })?.device;
        if (device === 'camera' || device === 'microphone' || device === 'screen')
          void media.revoke(device);
      }
    });
  }, [onControl, state.phase, state.room]);
  useEffect(() => {
    if (state.phase === 'joined' && chat.state.connection === 'connected')
      void state.room?.media.refresh();
    if (state.phase === 'joined' && chat.state.connection === 'denied') void controller.leave();
  }, [chat.state.connection, controller, state.phase, state.room]);
  const listSpaces = useCallback(
    async (signal: AbortSignal) => {
      if (!api) return [];
      await api.ensureSession();
      return api.sdk.native.spaces(signal);
    },
    [api],
  );
  const preview = useCallback(
    async (space: string, signal: AbortSignal) => {
      if (!api) throw new Error('SERVICE_NOT_CONFIGURED');
      await api.ensureSession();
      return api.sdk.native.preview(space, signal);
    },
    [api],
  );
  const releasePreview = useCallback(
    async (id: string) => {
      await api?.sdk.native.releasePreview(id);
    },
    [api],
  );
  const renewPreview = useCallback(
    async (id: string, signal: AbortSignal) => {
      await api?.sdk.native.renewPreview(id, signal);
    },
    [api],
  );
  return {
    feedback: async (body: FeedbackBody) => {
      if (!api) throw new Error('SERVICE_NOT_CONFIGURED');
      await api.ensureSession();
      return sendFeedback(api, body);
    },
    preview,
    releasePreview,
    renewPreview,
    state,
    chat,
    configured: !!api,
    listSpaces,
    hasPendingCleanup: controller.hasPendingCleanup(),
    join: controller.join,
    leave,
  };
}
