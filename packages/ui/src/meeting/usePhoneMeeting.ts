import { useState } from 'react';
import { meetingPage, type MeetingTile } from '@vocespace/meeting-core';

/** Layout state never owns or reconnects media. Start in grid, including when sharing a screen. */
export function usePhoneMeeting(tiles: readonly MeetingTile[], focusedExtraTile?: string) {
  const [requestedPage, setPage] = useState(0);
  const [pinned, setPinned] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const focusedId = tiles.find((tile) => tile.id === (focusedExtraTile ?? pinned))?.id;
  const layout = meetingPage(tiles, requestedPage, focusedId || null, focusedId ? 2 : 4);
  const focused = !!layout.focus;
  const height = Math.max(0, viewport.height - 16);
  // Keep the same two-row grid geometry for 2–4 tiles and incomplete pages.
  const rows = tiles.length > 1 ? 2 : 1;
  const railHeight = Math.max(128, Math.floor(height * 0.34));
  return {
    layout,
    explicitlyFocused: focused,
    size: {
      height: Math.max(160, Math.floor((height - (rows - 1) * 8) / rows)),
      focusHeight: Math.max(210, layout.tiles.length ? height - railHeight - 8 : height),
      railHeight,
    },
    viewport,
    setPage,
    setPinned: (id: string | null) => {
      setPinned(id);
      // Returning to grid reveals the formerly focused tile instead of jumping to a random page.
      setPage(
        id
          ? 0
          : Math.floor(
              Math.max(
                0,
                tiles.findIndex((tile) => tile.id === layout.focus?.id),
              ) / 4,
            ),
      );
    },
    measure: (width: number, height: number) =>
      setViewport((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      ),
  };
}
