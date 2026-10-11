'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n';
import { TransIfSystemStatus, UserStatus } from '@/lib/std';
import { socket } from '@/lib/realtime/socket';
import type { AllowGuest } from '@/lib/std/space';
import type { GeneralSettingsProps } from '../panels/general';

type Operation = 'status' | 'persistence' | 'guest';
export function useGeneralSettings({
  space,
  spaceInfo,
  localParticipant,
  messageApi,
}: GeneralSettingsProps) {
  const { t } = useI18n();
  const isOwner = localParticipant.identity === spaceInfo.ownerId;
  const incomingStatus =
    spaceInfo.participants[localParticipant.identity]?.status || UserStatus.Online;
  const [status, setStatus] = useState(() => TransIfSystemStatus(t, incomingStatus));
  const dirty = useRef(false);
  const [persistence, setPersistence] = useState(spaceInfo.persistence);
  const [allowGuest, setAllowGuest] = useState(spaceInfo.allowGuest);
  const [busy, setBusy] = useState<Partial<Record<Operation, boolean>>>({});
  const pending = useRef(new Set<Operation>());
  const generation = useRef(0);
  const active = useRef(false);
  useEffect(() => {
    const epoch = ++generation.current;
    active.current = true;
    return () => {
      active.current = false;
      generation.current = epoch + 1;
    };
  }, []);
  useEffect(() => {
    if (!dirty.current) setStatus(TransIfSystemStatus(t, incomingStatus));
  }, [incomingStatus, t]);
  useEffect(() => setPersistence(spaceInfo.persistence), [spaceInfo.persistence]);
  useEffect(() => setAllowGuest(spaceInfo.allowGuest), [spaceInfo.allowGuest]);
  async function run(
    operation: Operation,
    write: () => Promise<void>,
    success: () => void,
    successKey: string,
    failureKey: string,
  ) {
    if (!active.current || pending.current.has(operation)) return;
    const epoch = generation.current;
    pending.current.add(operation);
    setBusy((current) => ({ ...current, [operation]: true }));
    try {
      await write();
      if (!active.current || generation.current !== epoch) return;
      success();
      messageApi.success(t(successKey));
    } catch {
      if (active.current && generation.current === epoch) messageApi.error(t(failureKey));
    } finally {
      pending.current.delete(operation);
      if (active.current && generation.current === epoch)
        setBusy((current) => ({ ...current, [operation]: false }));
    }
  }
  return {
    t,
    isOwner,
    status,
    persistence,
    allowGuest,
    busy,
    setStatus: (value: string) => {
      dirty.current = true;
      setStatus(value);
    },
    saveStatus: () =>
      run(
        'status',
        async () => {
          const response = await api.defineUserStatus(space, localParticipant.identity, status);
          if (!response.ok) throw new Error('STATUS_SAVE_FAILED');
          const data: unknown = await response.json();
          if (!data || typeof data !== 'object' || !('success' in data) || data.success !== true)
            throw new Error('STATUS_SAVE_FAILED');
        },
        () => {
          dirty.current = false;
          socket.emit('update_user_status', { space });
        },
        'settings.general.status.define.success',
        'settings.general.status.define.fail',
      ),
    savePersistence: (value: boolean) => {
      if (!isOwner) return;
      return run(
        'persistence',
        async () => {
          if (!(await api.persistentSpace(space, value)).ok) throw new Error('SAVE_FAILED');
        },
        () => setPersistence(value),
        'settings.general.persistence.success',
        'settings.general.persistence.error',
      );
    },
    saveAllowGuest: (value: AllowGuest) => {
      if (!isOwner) return;
      return run(
        'guest',
        async () => {
          if (!(await api.allowGuest(space, value)).ok) throw new Error('SAVE_FAILED');
        },
        () => setAllowGuest(value),
        'settings.general.conf.allow_guest.success',
        'settings.general.conf.allow_guest.error',
      );
    },
  };
}
