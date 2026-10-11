import { useNativeDevices } from './useNativeDevices';
import type { NativeSettingsSnapshot, NativeSettingsPatch } from '@vocespace/contracts';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { meetingSettingsSections } from '@vocespace/ui';
import type { MeetingAction } from '@vocespace/ui';
import type { NativeRoom } from './room';
import type { useMeetingRoom } from './useMeetingRoom';
import { useI18n } from '../i18n';
import { createSettingsElements } from '../ui/settings-elements';

/** Capabilities come from the server snapshot; drafts and requests belong to this room. */
export function useRoomSettings(
  room: NativeRoom,
  model: ReturnType<typeof useMeetingRoom>,
  actions: MeetingAction[],
  participantName?: string,
) {
  const i18n = useI18n();
  const devices = useNativeDevices(room);
  const { t } = i18n;
  const [selected, setSelected] = useState<string>();
  const [visited, setVisited] = useState<string[]>([]);
  const select = useCallback((panel?: string) => {
    if (panel) setVisited((old) => (old.includes(panel) ? old : [...old, panel]));
    setSelected(panel);
  }, []);
  const [snapshot, setSnapshot] = useState<NativeSettingsSnapshot>();
  const [draft, setDraft] = useState<NativeSettingsPatch>({});
  const [saving, setSaving] = useState(false);
  const flight = useRef(false);
  const revision = useRef(0);
  const lifetime = useRef(new AbortController());
  useEffect(() => {
    lifetime.current = new AbortController();
    return () => lifetime.current.abort();
  }, [room]);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const linkError = useCallback(() => setError('native_settings.open_failed'), []);
  const elements = useMemo(() => createSettingsElements(linkError), [linkError]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const version = revision.current;
    setLoading(true);
    setError(undefined);
    void room
      .settings(controller.signal)
      .then((value) => {
        if (active && version === revision.current) setSnapshot(value);
      })
      .catch(() => {
        if (active && version === revision.current) {
          setSnapshot(undefined);
          setError('native_settings.read_error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [room, reload]);
  useEffect(() => {
    setSelected(undefined);
    setVisited([]);
    setSnapshot(undefined);
    setDraft({});
  }, [room]);
  const save = async (patch: NativeSettingsPatch) => {
    if (flight.current || !snapshot) return false;
    const signal = lifetime.current.signal;
    flight.current = true;
    revision.current++;
    setSaving(true);
    setError(undefined);
    try {
      const value = await room.updateSettings(patch, signal);
      if (signal.aborted) return false;
      setSnapshot(value);
      setDraft((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([key]) => !(key in patch))),
      );
      return true;
    } catch {
      if (!signal.aborted) setError('native_settings.save_error');
      return false;
    } finally {
      flight.current = false;
      if (!signal.aborted) setSaving(false);
    }
  };
  // Refresh remote Web changes while a settings page is visible, without replacing local drafts.
  useEffect(() => {
    if (!selected) return;
    const timer = setInterval(() => {
      if (!flight.current) setReload((value) => value + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, [selected]);
  const showAI = false; // Same as Web platform.ts: a guest session does not expose AI.
  const panels = meetingSettingsSections
    .filter((panel) => panel.id !== 'ai' || showAI)
    .map((panel) => ({ ...panel, label: t(panel.labelKey) }));
  const name =
    snapshot?.name ||
    room.raw.localParticipant.name ||
    participantName ||
    t('native_settings.guest');
  return {
    ...i18n,
    devices,
    room,
    snapshot,
    visible: model.panel === 'settings',
    draft,
    edit: (patch: NativeSettingsPatch) => setDraft((previous) => ({ ...previous, ...patch })),
    save,
    saving,
    loading,
    retry: () => setReload((value) => value + 1),
    panels,
    selected,
    select,
    visited,
    elements,
    error: error || i18n.error,
    name,
    spaceName: room.raw.name,
    connected: model.connection === 'connected',
    media: model.media,
    actions,
  };
}
