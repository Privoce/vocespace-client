import type { DashboardSnapshot } from '@vocespace/contracts';
import type { SpaceInfoMap, SpaceDateRecords, SpaceTimeRecord } from '@vocespace/domain/space';

export function dashboardSnapshot(spaces: SpaceInfoMap, records: SpaceDateRecords): DashboardSnapshot {
  const times = (values: SpaceTimeRecord[]) => values.map(({ start, end }) => ({ start, end }));
  return {
    spaces: Object.fromEntries(Object.entries(spaces).map(([name, space]) => [name, {
      isRecording: !!space.record?.active,
      participants: Object.fromEntries(Object.entries(space.participants || {}).map(([id, user]) => [id, {
        name: user.name,
        volume: user.volume,
        blur: user.blur,
        screenBlur: user.screenBlur,
        online: user.online,
        isOwner: space.ownerId === id,
        isAuth: user.auth?.platform === 'vocespace' || user.auth?.platform === 'space',
        isGuest: !user.auth || user.auth.identity === 'guest' || user.auth.platform === 'other',
        virtualEnabled: !!user.virtual?.enabled,
      }])),
    }])),
    records: Object.fromEntries(Object.entries(records).map(([name, record]) => [name, {
      space: times(record.space),
      participants: Object.fromEntries(Object.entries(record.participants).map(([id, values]) => [id, times(values)])),
    }])),
  };
}
