import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { AccountSpace } from '@vocespace/contracts';
import type { AccountModel } from '../../../account/hooks/useAccount';
import { resolveSpaceInput } from '../../../conference/space-input';
export function useMySpaces(account: AccountModel, active: boolean) {
  const [rows, setRows] = useState<{ owner: string; rooms: AccountSpace[] }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, refresh] = useState(0);
  const latest = useRef(account);
  latest.current = account;
  const owner = account.profile.id;
  useEffect(() => {
    if (!active || !owner) {
      setLoading(false);
      setError(false);
      return;
    }
    let disposed = false;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      setLoading(true);
      setError(false);
      try {
        const rooms = await latest.current.listSpaces();
        if (!disposed) setRows({ owner, rooms });
      } catch {
        if (!disposed) setError(true);
      } finally {
        pending = false;
        if (!disposed) setLoading(false);
      }
    };
    void load();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      disposed = true;
      listener.remove();
    };
  }, [active, owner, revision]);
  const rooms = (rows?.owner === owner ? rows.rooms : []).map((room) => ({
    ...room,
    spaceName: resolveSpaceInput(room.url, process.env.EXPO_PUBLIC_API_URL),
  }));
  const primary = account.profile.username;
  if (owner && primary && !rooms.some((room) => room.spaceName === primary))
    rooms.unshift({
      id: `primary:${owner}`,
      name: primary,
      url: primary,
      spaceName: primary,
      kind: 'meeting',
    });
  return { rooms, loading, error, refresh: () => refresh((value) => value + 1) };
}
