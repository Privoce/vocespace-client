import { useState } from 'react';
import { meetingPage, meetingTileSize, type MeetingTile } from '@vocespace/meeting-core';
export function usePhoneMeeting(tiles: readonly MeetingTile[], focusedExtraTile?: string) {
  const [requestedPage, setPage] = useState(0);
  const [pinned, setPinned] = useState<string | null>();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const layout = meetingPage(tiles, requestedPage, focusedExtraTile ?? pinned);
  const size = meetingTileSize(
    viewport.width,
    Math.max(0, viewport.height - (layout.pages > 1 ? 40 : 0)),
    layout.tiles.length,
    !!layout.focus,
  );
  return {
    layout,
    size,
    viewport,
    setPage,
    setPinned,
    measure: (width: number, height: number) =>
      setViewport((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      ),
  };
}
