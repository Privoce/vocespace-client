import { DEFAULT_PARTICIPANT_SETTINGS } from '@vocespace/domain/space';
import { nativeCreateEndpoint } from './native-create';
import { parseJoinId } from '@vocespace/contracts';
import { spaceRepository } from './lib/server/space-repository';
import { requireNativeChatMember } from './lib/server/native-chat';
import { requireNative } from './native-auth';
import { ApiRequest, ApiResponse } from './http';
export async function nativeSpacesEndpoint(request: ApiRequest) {
  if (request.method === 'POST') return nativeCreateEndpoint(request);
  const { principal } = await requireNative(request);
  if (request.method !== 'GET') return new ApiResponse(null, { status: 405 });
  const items = [];
  const spaces = await spaceRepository.list();
  for (const [name, space] of Object.entries(spaces).sort(([a], [b]) => a.localeCompare(b))) {
    if (
      !space ||
      (space.allowGuest !== 'allow' &&
        (!principal.identities?.[name] || space.ownerId !== principal.identities[name])) ||
      !Array.isArray(space.children)
    )
      continue;
    items.push({
      name,
      participantCount: Object.keys(space.participants).length,
      roomCount: space.children.filter((child) => !child.isPrivate).length + 1,
    });
  }
  return ApiResponse.json(items, { headers: { 'Cache-Control': 'no-store' } });
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
