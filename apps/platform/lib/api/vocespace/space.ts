import { platformFetch } from '../client';
import { createClient } from '../../supabase/client';
import { space as database } from '../db/space';
import { initSpace, vocespaceUrlVisit, SpaceState, type Space } from '../../std/space';
export const createSpace = (_uid: string, username: string, spaceName?: string) =>
  platformFetch('create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spaceName: spaceName || username }),
  });
export interface DiscoveryResult {
  spaces: Space[];
  unavailable: ('catalog' | 'live')[];
}
interface LiveSpace {
  name: string;
  participantCount: number;
}
function roomKey(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return url.replace(/\/+$/, '');
  }
}
export function mergeDirectory(
  catalog: Space[],
  live: LiveSpace[],
  meetingUrl: (name: string) => string,
): Space[] {
  const result = new Map<string, Space>();
  for (const space of catalog) {
    if (space.public)
      result.set(roomKey(space.url), { ...space, online_count: 0, state: SpaceState.Waiting });
  }
  for (const room of live) {
    const url = meetingUrl(room.name);
    const key = roomKey(url);
    const existing = result.get(key);
    result.set(
      key,
      existing
        ? { ...existing, online_count: room.participantCount, state: SpaceState.Active }
        : {
            ...initSpace({ name: room.name, owner_id: 'public', url, public: true })!,
            online_count: room.participantCount,
            state: SpaceState.Active,
          },
    );
  }
  return [...result.values()].sort(
    (a, b) =>
      (b.online_count || 0) - (a.online_count || 0) || (b.sub_count || 0) - (a.sub_count || 0),
  );
}
/** Independent sources: a failed live service must never erase a valid published catalog. */
export async function loadDirectory(
  catalog: () => Promise<Space[]>,
  live: () => Promise<LiveSpace[]>,
  meetingUrl = vocespaceUrlVisit,
): Promise<DiscoveryResult> {
  const [stored, running] = await Promise.allSettled([
    Promise.resolve().then(catalog),
    Promise.resolve().then(live),
  ]);
  return {
    spaces: mergeDirectory(
      stored.status === 'fulfilled' ? stored.value : [],
      running.status === 'fulfilled' ? running.value : [],
      meetingUrl,
    ).map((space) =>
      running.status === 'rejected' ? { ...space, online_count: undefined } : space,
    ),
    unavailable: [
      ...(stored.status === 'rejected' ? ['catalog' as const] : []),
      ...(running.status === 'rejected' ? ['live' as const] : []),
    ],
  };
}
export async function allSpaces(signal?: AbortSignal): Promise<DiscoveryResult> {
  return loadDirectory(
    () => database.getPublic(createClient(), signal),
    async () => {
      const response = await platformFetch('spaces', { signal });
      if (!response.ok) throw new Error('LIVE_DIRECTORY_UNAVAILABLE');
      const data: unknown = await response.json();
      if (
        !Array.isArray(data) ||
        data.some(
          (item) =>
            !item ||
            typeof item.name !== 'string' ||
            !Number.isFinite(item.participantCount) ||
            item.participantCount < 0,
        )
      )
        throw new Error('INVALID_DIRECTORY');
      return data;
    },
  );
}
export const vocespace = { createSpace, allSpaces };
