/** Serializable display data only. RTC objects stay in each application's adapter. */
export interface MeetingTile {
  id: string;
  name: string;
  screen?: boolean;
  speaking?: boolean;
  video?: boolean;
  microphone?: boolean;
  local?: boolean;
  role?: string;
  status?: string;
  statusColor?: string;
  avatarColor?: string;
  manager?: boolean;
  owner?: boolean;
  raiseHand?: boolean;
  avo?: import('./avo').AvoParams;
}
export function meetingPage<T extends MeetingTile>(
  tiles: readonly T[],
  requestedPage: number,
  pinned: string | null | undefined,
  pageSize = 4,
) {
  // undefined: follow screen sharing; null: explicitly return to the grid.
  const focus =
    pinned === null
      ? undefined
      : tiles.find((tile) => tile.id === pinned) || tiles.find((tile) => tile.screen);
  const grid = tiles.filter((tile) => tile.id !== focus?.id);
  const limit = Number.isFinite(pageSize) ? Math.max(1, Math.trunc(pageSize)) : 4;
  const pages = Math.max(1, Math.ceil(grid.length / limit));
  const page = Math.max(0, Math.min(Math.trunc(requestedPage) || 0, pages - 1));
  return { focus, page, pages, tiles: grid.slice(page * limit, page * limit + limit) };
}

/** A committed horizontal swipe; short drags, vertical scrolling and returning cancel it. */
export function meetingPageSwipe(dx: number, dy: number) {
  return Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx < 0 ? 1 : -1) : 0;
}

/** Use the available stage height; narrow/short windows can scroll without crushing tiles. */
export function meetingTileSize(width: number, height: number, count: number, focused: boolean) {
  const columns = count === 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(count / columns));
  const contentWidth = Math.max(0, width - 16);
  return {
    width: Math.max(0, (contentWidth - (columns - 1) * 6) / columns),
    height: Math.max(150, Math.floor((height - 16 - (rows - 1) * 6) / rows)),
    focusHeight: Math.max(200, Math.floor(height * 0.65)),
    railHeight: focused ? 132 : undefined,
  };
}
export function avatarColor(identity: string) {
  let hash = 0;
  for (const char of identity) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return ['#4F86CD', '#55BFB1', '#9677CC', '#D49855'][Math.abs(hash) % 4];
}
export {
  avoStyles,
  avoPalette,
  virtualModels,
  virtualBackgrounds,
  licenseDetailKeys,
} from './settings';

export { participantColor } from './participant';

export { Creature, normalizeAvo } from './avo';
export type { AvoParams, AvoDrawing, CreaturePointer } from './avo';
