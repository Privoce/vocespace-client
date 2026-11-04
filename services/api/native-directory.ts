import { DEFAULT_PARTICIPANT_SETTINGS } from '@vocespace/domain/space';
import { nativeCreateEndpoint } from './native-create';
import { parseJoinId } from '@vocespace/contracts';
import { spaceRepository } from './lib/server/space-repository';
import { liveSpaceClient, liveSpaceMembers } from './lib/server/live-space-presence';
import { requireNativeChatMember } from './lib/server/native-chat';
import { requireNative } from './native-auth';
import { ApiRequest, ApiResponse } from './http';
export async function nativeSpacesEndpoint(request: ApiRequest) {
  if (request.method === 'POST') return nativeCreateEndpoint(request);
  await requireNative(request);
  if (request.method !== 'GET') return new ApiResponse(null, { status: 405 });
  return ApiResponse.json(await publicLiveSpaces(), { headers: { 'Cache-Control': 'no-store' } });
}
export async function publicLiveSpaces() {
  const items = [];
  const media = liveSpaceClient();
  // LiveKit owns the current-room directory. Redis only supplies each candidate's policy/data;
  // a missing/stale space:list: index must not decide which live rooms can be discovered.
  const liveRooms = await media.listRooms();
  for (const { name } of liveRooms.sort((a, b) => a.name.localeCompare(b.name))) {
    const space = await spaceRepository.get(name);
    if (
      !space ||
      space.allowGuest !== 'allow' ||
      !Array.isArray(space.children)
    )
      continue;
    const connected = await liveSpaceMembers(name, media);
    const participantCount = Object.keys(space.participants).filter((id) => connected.has(id)).length;
    if (!participantCount) continue;
    items.push({
      name,
      participantCount,
      roomCount: space.children.filter((child) => !child.isPrivate).length + 1,
    });
  }
  return items;
}
export async function nativeRoomsEndpoint(request: ApiRequest) {
  const { principal } = await requireNative(request);
  if (request.method !== 'POST') return new ApiResponse(null, { status: 405 });
  const joinId = parseJoinId(await request.json());
  const access = await requireNativeChatMember(principal, joinId);
  const space = await spaceRepository.get(access.spaceName);
  const current = await requireNative(request);
  await requireNativeChatMember(current.principal, joinId);
  const grouped = new Set(space!.children.flatMap((child) => child.participants));
  const privateIds = new Set(
    space!.children.filter((child) => child.isPrivate).flatMap((child) => child.participants),
  );
  const inRoom = new Set(
    access.roomName === access.spaceName
      ? Object.keys(space!.participants).filter((id) => !grouped.has(id))
      : space!.children.find((child) => child.name === access.roomName)?.participants || [],
  );
  const participants = Object.fromEntries(
    Object.entries(space!.participants)
      .filter(([id]) => !privateIds.has(id))
      .map(([id, value]) => {
        const list = value.avoList?.length ? value.avoList : DEFAULT_PARTICIPANT_SETTINGS.avoList!;
        const avo = list.find((item) => item.isUsed) ?? list[0];
        return [
          id,
          {
            name: value.name || '访客',
            status: value.status || '',
            raiseHand: !!value.raiseHand,
            owner: space!.ownerId === id,
            manager: space!.managers.includes(id),
            ...(inRoom.has(id)
              ? {
                  apps: {
                    ...(value.sync?.includes('todo') && space!.apps.includes('todo')
                      ? {
                          todo: (value.appDatas?.todo || [])
                            .flatMap((group) => group.items)
                            .filter((item) => item.visible !== false)
                            .slice(0, 1000)
                            .map((item) => ({ id: item.id, title: item.title, done: !!item.done })),
                        }
                      : {}),
                    ...(value.sync?.includes('timer') &&
                    space!.apps.includes('timer') &&
                    value.appDatas?.timer
                      ? {
                          timer: {
                            value: value.appDatas.timer.value,
                            running: value.appDatas.timer.running,
                            stopTimeStamp: value.appDatas.timer.stopTimeStamp,
                            records: value.appDatas.timer.records,
                          },
                        }
                      : {}),
                    ...(value.sync?.includes('countdown') &&
                    space!.apps.includes('countdown') &&
                    value.appDatas?.countdown
                      ? {
                          countdown: {
                            value: value.appDatas.countdown.value,
                            running: value.appDatas.countdown.running,
                            stopTimeStamp: value.appDatas.countdown.stopTimeStamp,
                            duration: value.appDatas.countdown.duration,
                          },
                        }
                      : {}),
                  },
                }
              : {}),
            ...(avo
              ? {
                  hue: avo.hue,
                  avo: {
                    name: avo.name,
                    variant: avo.variant,
                    hue: avo.hue,
                    style: avo.style,
                    energy: avo.energy,
                    isUsed: avo.isUsed,
                    enabled: avo.enabled,
                  },
                }
              : {}),
          },
        ];
      }),
  );
  return ApiResponse.json({
    participants,
    current: access.roomName,
    rooms: [
      {
        name: access.spaceName,
        participantIds: Object.keys(space!.participants).filter((id) => !grouped.has(id)),
      },
      ...space!.children
        .filter((child) => !child.isPrivate)
        .map((child) => ({
          name: child.name,
          participantIds: child.participants.filter((id) => !!space!.participants[id]),
        })),
    ],
  });
}
